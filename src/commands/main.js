import { join, relative } from 'path'
import fse from 'fs-extra'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { resolveAssignmentPath, parseAssignmentId, assignmentName, formatStatus, timeSince } from '../utils/assignment.js'

/**
 * specdev main <subcommand> [options]
 *
 * Implementer-side commands:
 *   request-review  [--mode=auto|manual]  Create review request
 *   status                                Check review status (non-blocking)
 *   poll-review     [--timeout=<seconds>] Block until review feedback arrives
 */
export async function mainCommand(subcommand, flags = {}) {
  switch (subcommand) {
    case 'request-review':
      return await mainRequestReview(flags)
    case 'status':
      return await mainStatus(flags)
    case 'poll-review':
      return await mainPollReview(flags)
    default:
      console.error(`Unknown main subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev main <request-review|status|poll-review>')
      console.log('')
      console.log('  request-review  [--mode=auto|manual]   Create review request')
      console.log('  status                                 Check review status')
      console.log('  poll-review     [--timeout=<seconds>]  Block until review feedback arrives')
      process.exit(1)
  }
}

/**
 * specdev main request-review [--mode=auto|manual]
 */
async function mainRequestReview(flags) {
  const gate = 'review'

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

  const name = assignmentName(assignmentPath)
  const parsed = parseAssignmentId(name)

  const gitOpts = { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd: targetDir }

  let headCommit = ''
  try {
    headCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], gitOpts).trim()
  } catch { /* not in git repo */ }

  let changedFiles = []
  try {
    // Tracked changes (staged + unstaged) against HEAD
    let diff = execFileSync('git', ['diff', '--name-only', 'HEAD'], gitOpts).trim()
    if (!diff) {
      // No working tree changes — use last commit diff (skip on initial commit)
      diff = execFileSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], gitOpts).trim()
    }
    if (diff) changedFiles = diff.split('\n').filter(Boolean)
  } catch { /* no commits yet or not in git repo */ }
  try {
    // Include untracked files so new files aren't missed in review scope
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      ...gitOpts, maxBuffer: 10 * 1024 * 1024,
    }).trim()
    if (untracked) changedFiles.push(...untracked.split('\n').filter(Boolean))
  } catch { /* not in git repo */ }

  const request = {
    version: 1,
    assignment_id: parsed.id || name,
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
  console.log(`   Assignment: ${name}`)
  console.log(`   Mode: ${mode}`)
  console.log('')
  console.log('   Reviewer picks this up with: specdev review start')
}

/**
 * specdev main status — non-blocking check of review state
 */
async function mainStatus(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')

  if (!(await fse.pathExists(requestPath))) {
    console.log('ℹ️  No review request found')
    console.log('   Create one with: specdev main request-review')
    return
  }

  const request = await fse.readJson(requestPath)
  const name = assignmentName(assignmentPath)

  // Read progress if available
  const progressPath = join(assignmentPath, 'review_progress.json')
  let progress = null
  if (await fse.pathExists(progressPath)) {
    try { progress = await fse.readJson(progressPath) } catch { /* malformed */ }
  }

  console.log(`📋 Review Status: ${name}`)
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

/**
 * specdev main poll-review [--timeout=<seconds>]
 * Block until review/review-feedback.md appears
 */
async function mainPollReview(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const timeout = flags.timeout ? parseInt(flags.timeout, 10) : 1800

  const scriptPath = fileURLToPath(new URL('../../templates/.specdev/skills/core/implementing/scripts/poll-for-feedback.sh', import.meta.url))

  try {
    const output = execFileSync('bash', [scriptPath, assignmentPath, 'implementation', String(timeout)], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: (timeout + 10) * 1000,
    })
    console.log(output)
  } catch (err) {
    if (err.stderr) console.error(err.stderr)
    if (err.stdout) console.log(err.stdout)
    console.error('❌ Timed out waiting for review feedback')
    process.exit(1)
  }
}
