import { join, relative } from 'path'
import fse from 'fs-extra'
import { execSync } from 'child_process'
import { findLatestAssignment } from '../utils/scan.js'

/**
 * specdev work <subcommand> [options]
 *
 * Implementer-side commands:
 *   request  --gate=gate_3|gate_4 [--mode=auto|manual]  Create review request
 *   status                                                Check review status (non-blocking)
 */
export async function workCommand(subcommand, flags = {}) {
  switch (subcommand) {
    case 'request':
      return await workRequest(flags)
    case 'status':
      return await workStatus(flags)
    default:
      console.error(`Unknown work subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev work <request|status>')
      console.log('')
      console.log('  request  --gate=gate_3|gate_4 [--mode=auto|manual]  Create review request')
      console.log('  status                                               Check review status')
      process.exit(1)
  }
}

async function resolveAssignmentPath(flags) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  if (flags.assignment) {
    const assignmentPath = join(specdevPath, 'assignments', flags.assignment)
    if (!(await fse.pathExists(assignmentPath))) {
      console.error(`❌ Assignment not found: ${flags.assignment}`)
      process.exit(1)
    }
    return assignmentPath
  }

  const latest = await findLatestAssignment(specdevPath)
  if (!latest) {
    console.error('❌ No assignments found')
    process.exit(1)
  }
  return latest.path
}

function parseAssignmentId(name) {
  const match = name.match(/^(\d+)_(\w+?)_(.+)$/)
  if (match) return { id: match[1], type: match[2], label: match[3] }
  return { id: null, type: null, label: name }
}

/**
 * specdev work request --gate=gate_3|gate_4 [--mode=auto|manual]
 */
async function workRequest(flags) {
  const gate = flags.gate
  if (!gate || !['gate_3', 'gate_4'].includes(gate)) {
    console.error('❌ --gate is required (gate_3 or gate_4)')
    process.exit(1)
  }

  const mode = flags.mode || 'auto'
  if (!['auto', 'manual'].includes(mode)) {
    console.error('❌ --mode must be auto or manual')
    process.exit(1)
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()

  // Block if there's already an active review
  if (await fse.pathExists(requestPath)) {
    const existing = await fse.readJson(requestPath)
    if (existing.status === 'pending' || existing.status === 'in_progress' || existing.status === 'awaiting_approval') {
      console.error(`❌ A review is already ${existing.status} for this assignment`)
      console.log('   Wait for the current review to complete')
      process.exit(1)
    }
  }

  const assignmentName = assignmentPath.split(/[/\\]/).pop()
  const parsed = parseAssignmentId(assignmentName)

  const gitOpts = { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd: targetDir }

  let headCommit = ''
  try {
    headCommit = execSync('git rev-parse --short HEAD', gitOpts).trim()
  } catch { /* not in git repo */ }

  let changedFiles = []
  try {
    // Tracked changes (staged + unstaged) against HEAD
    let diff = execSync('git diff --name-only HEAD', gitOpts).trim()
    if (!diff) {
      // No working tree changes — use last commit diff (skip on initial commit)
      diff = execSync('git diff --name-only HEAD~1 HEAD', gitOpts).trim()
    }
    if (diff) changedFiles = diff.split('\n').filter(Boolean)
  } catch { /* no commits yet or not in git repo */ }
  try {
    // Include untracked files so new files aren't missed in review scope
    const untracked = execSync('git ls-files --others --exclude-standard', {
      ...gitOpts, maxBuffer: 10 * 1024 * 1024,
    }).trim()
    if (untracked) changedFiles.push(...untracked.split('\n').filter(Boolean))
  } catch { /* not in git repo */ }

  const request = {
    version: 1,
    assignment_id: parsed.id || assignmentName,
    assignment_path: relative(targetDir, assignmentPath).split('\\').join('/'),
    gate,
    status: 'pending',
    mode,
    timestamp: new Date().toISOString(),
    head_commit: headCommit,
    changed_files: changedFiles,
    notes: flags.notes || '',
  }

  await fse.writeJson(requestPath, request, { spaces: 2 })

  console.log(`✅ Review request created`)
  console.log(`   Assignment: ${assignmentName}`)
  console.log(`   Gate: ${gate}`)
  console.log(`   Mode: ${mode}`)
  console.log('')
  console.log('   Reviewer picks this up with: specdev check run')
}

/**
 * specdev work status — non-blocking check of review state
 */
async function workStatus(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')

  if (!(await fse.pathExists(requestPath))) {
    console.log('ℹ️  No review request found')
    console.log('   Create one with: specdev work request --gate=gate_3')
    return
  }

  const request = await fse.readJson(requestPath)
  const assignmentName = assignmentPath.split(/[/\\]/).pop()

  // Read progress if available
  const progressPath = join(assignmentPath, 'review_progress.json')
  let progress = null
  if (await fse.pathExists(progressPath)) {
    try { progress = await fse.readJson(progressPath) } catch { /* malformed */ }
  }

  console.log(`📋 Review Status: ${assignmentName}`)
  console.log(`   Gate: ${request.gate} | Mode: ${request.mode || 'auto'}`)
  console.log(`   Status: ${formatStatus(request.status)}`)

  if (progress) {
    const reviewed = progress.files_reviewed ? progress.files_reviewed.length : 0
    const total = progress.files_total || 0
    const lastActivity = progress.last_activity
      ? timeSince(progress.last_activity)
      : 'unknown'
    console.log(`   Progress: ${reviewed}/${total} files reviewed`)
    console.log(`   Last activity: ${lastActivity}`)
  }

  if (request.completed_at) {
    console.log(`   Completed: ${request.completed_at}`)
  }

  if (request.reviewer_notes) {
    console.log(`   Reviewer notes: ${request.reviewer_notes}`)
  }

  const reportPath = join(assignmentPath, 'review_report.md')
  if (await fse.pathExists(reportPath)) {
    console.log(`   📄 Report: ${reportPath}`)
  }

  // Exit code signals result to the agent
  if (request.status === 'failed') {
    process.exit(1)
  }
}

function formatStatus(status) {
  const icons = {
    pending: '⏳ pending',
    in_progress: '🔄 in_progress',
    awaiting_approval: '👀 awaiting_approval',
    passed: '✅ passed',
    failed: '❌ failed',
  }
  return icons[status] || status
}

function timeSince(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
