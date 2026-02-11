import { join, resolve, relative } from 'path'
import fse from 'fs-extra'
import { execSync } from 'child_process'
import { findLatestAssignment } from '../utils/scan.js'

/**
 * specdev check <subcommand> [options]
 *
 * Reviewer-side commands:
 *   status                              Show pending/active reviews (non-blocking)
 *   run     [--assignment=...]          Run preflight + start review
 *   resume  [--assignment=...]          Resume interrupted review from checkpoint
 *   accept  [--notes="..."]             Mark review as passed
 *   reject  [--reason="..."]            Mark review as failed
 */
export async function checkCommand(subcommand, flags = {}) {
  switch (subcommand) {
    case 'status':
      return await checkStatus(flags)
    case 'run':
      return await checkRun(flags)
    case 'resume':
      return await checkResume(flags)
    case 'accept':
      return await checkAccept(flags)
    case 'reject':
      return await checkReject(flags)
    default:
      console.error(`Unknown check subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev check <status|run|resume|accept|reject>')
      console.log('')
      console.log('  status                          Show pending/active reviews')
      console.log('  run    [--assignment=...]        Run preflight + start review')
      console.log('  resume [--assignment=...]        Resume interrupted review from checkpoint')
      console.log('  accept [--notes="..."]           Mark review as passed')
      console.log('  reject [--reason="..."]          Mark review as failed')
      process.exit(1)
  }
}

async function resolveAssignmentPath(flags) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
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

/**
 * Scan all assignments for a pending review_request.json
 */
async function findPendingReview(specdevPath) {
  const assignmentsDir = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsDir))) return null

  const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
  const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))

  for (const dir of dirs) {
    const requestPath = join(assignmentsDir, dir.name, 'review_request.json')
    if (await fse.pathExists(requestPath)) {
      try {
        const request = await fse.readJson(requestPath)
        if (request.status === 'pending') {
          return { assignmentName: dir.name, assignmentPath: join(assignmentsDir, dir.name), request }
        }
      } catch { /* malformed JSON */ }
    }
  }
  return null
}

/**
 * specdev check status — non-blocking scan for reviews
 */
async function checkStatus(flags) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    process.exit(1)
  }

  // If --assignment specified, show that specific assignment's review
  if (flags.assignment) {
    const assignmentPath = await resolveAssignmentPath(flags)
    return await showReviewStatus(assignmentPath)
  }

  // Otherwise scan for any pending/in_progress reviews
  const assignmentsDir = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsDir))) {
    console.log('ℹ️  No pending reviews found')
    return
  }

  const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
  const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))

  let found = false
  for (const dir of dirs) {
    const requestPath = join(assignmentsDir, dir.name, 'review_request.json')
    if (await fse.pathExists(requestPath)) {
      try {
        const request = await fse.readJson(requestPath)
        if (['pending', 'in_progress', 'awaiting_approval'].includes(request.status)) {
          found = true
          await showReviewStatus(join(assignmentsDir, dir.name))
          console.log('')
        }
      } catch { /* skip malformed */ }
    }
  }

  if (!found) {
    console.log('ℹ️  No pending reviews found')
  }
}

async function showReviewStatus(assignmentPath) {
  const requestPath = join(assignmentPath, 'review_request.json')
  const request = await fse.readJson(requestPath)
  const assignmentName = assignmentPath.split(/[/\\]/).pop()

  console.log(`📋 ${assignmentName}`)
  console.log(`   Gate: ${request.gate} | Mode: ${request.mode || 'auto'} | Status: ${formatStatus(request.status)}`)

  const progressPath = join(assignmentPath, 'review_progress.json')
  if (await fse.pathExists(progressPath)) {
    try {
      const progress = await fse.readJson(progressPath)
      const reviewed = progress.files_reviewed ? progress.files_reviewed.length : 0
      const total = progress.files_total || 0
      const lastActivity = progress.last_activity ? timeSince(progress.last_activity) : 'unknown'
      console.log(`   Progress: ${reviewed}/${total} files | Last activity: ${lastActivity}`)
    } catch { /* skip */ }
  }

  if (request.reviewer_notes) {
    console.log(`   Reviewer: ${request.reviewer_notes}`)
  }
}

/**
 * specdev check run — run preflight and start review
 */
async function checkRun(flags) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  let assignmentPath
  let request

  if (flags.assignment) {
    assignmentPath = await resolveAssignmentPath(flags)
    const requestPath = join(assignmentPath, 'review_request.json')
    if (!(await fse.pathExists(requestPath))) {
      console.error('❌ No review request found')
      process.exit(1)
    }
    request = await fse.readJson(requestPath)
  } else {
    // Find first pending review
    const found = await findPendingReview(specdevPath)
    if (!found) {
      console.log('ℹ️  No pending reviews found')
      return
    }
    assignmentPath = found.assignmentPath
    request = found.request
  }

  if (request.status !== 'pending') {
    console.error(`❌ Review is not pending (status: ${request.status})`)
    process.exit(1)
  }

  // Lock
  const lockPath = join(assignmentPath, 'review_request.lock')
  if (await fse.pathExists(lockPath)) {
    console.error('❌ Lock file exists — another reviewer may be active')
    console.log(`   Lock: ${lockPath}`)
    console.log('   If stale, run: specdev check resume')
    process.exit(1)
  }

  await fse.writeFile(lockPath, new Date().toISOString())

  // Preflight
  const scriptPath = resolve(new URL('../../scripts/verify-gates.sh', import.meta.url).pathname)
  console.log('── Pre-flight: verify-gates.sh ──')
  console.log('')

  try {
    const output = execSync(`bash "${scriptPath}" "${assignmentPath}"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    })
    console.log(output)
  } catch (err) {
    console.log(err.stdout || '')
    console.log(err.stderr || '')
    console.log('')
    console.log('⚠️  Pre-flight found issues. Fix before proceeding.')
    await fse.remove(lockPath)
    process.exit(1)
  }

  // Update status
  const requestPath = join(assignmentPath, 'review_request.json')
  request.status = 'in_progress'
  await fse.writeJson(requestPath, request, { spaces: 2 })

  // Create initial progress file
  const progressPath = join(assignmentPath, 'review_progress.json')
  const progress = {
    phase: 'reviewing',
    mode: request.mode || 'auto',
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    files_total: request.changed_files ? request.changed_files.length : 0,
    files_reviewed: [],
    files_remaining: request.changed_files || [],
    findings_so_far: 0,
    session_id: Math.random().toString(36).slice(2, 10),
  }
  await fse.writeJson(progressPath, progress, { spaces: 2 })

  const assignmentName = assignmentPath.split(/[/\\]/).pop()
  console.log(`🔍 Starting review: ${assignmentName}`)
  console.log(`   Gate: ${request.gate} | Mode: ${request.mode || 'auto'}`)
  console.log('')

  // Print gate-specific instructions
  if (request.gate === 'gate_3') {
    console.log('Gate 3: Spec Compliance Review')
    console.log('1. Read proposal.md — what was requested')
    console.log('2. Read plan.md — the approved approach')
    console.log('3. Read changed files — what was built')
    console.log('4. Compare against spec, write findings in review_report.md')
    console.log('5. Update review_progress.json after each file')
    console.log('6. Run: specdev check accept  OR  specdev check reject --reason="..."')
  } else if (request.gate === 'gate_4') {
    console.log('Gate 4: Code Quality Review')
    console.log('1. Read all changed files')
    console.log('2. Review for quality, architecture, testing, style')
    console.log('3. Write findings in review_report.md')
    console.log('4. Update review_progress.json after each file')
    console.log('5. Run: specdev check accept  OR  specdev check reject --reason="..."')
  }

  if (request.changed_files && request.changed_files.length > 0) {
    console.log('')
    console.log('Changed files:')
    for (const f of request.changed_files) {
      console.log(`   - ${f}`)
    }
  }
}

/**
 * specdev check resume — resume interrupted review from checkpoint
 */
async function checkResume(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')
  const progressPath = join(assignmentPath, 'review_progress.json')

  if (!(await fse.pathExists(requestPath))) {
    console.error('❌ No review request found')
    process.exit(1)
  }

  const request = await fse.readJson(requestPath)
  const assignmentName = assignmentPath.split(/[/\\]/).pop()

  if (!(await fse.pathExists(progressPath))) {
    console.log('ℹ️  No progress file found — starting fresh')
    console.log('   Run: specdev check run')
    return
  }

  const progress = await fse.readJson(progressPath)
  const reviewed = progress.files_reviewed || []
  const remaining = progress.files_remaining || []
  const total = progress.files_total || 0

  // Take over: update session and lock
  const lockPath = join(assignmentPath, 'review_request.lock')
  await fse.writeFile(lockPath, new Date().toISOString())
  progress.session_id = Math.random().toString(36).slice(2, 10)
  progress.last_activity = new Date().toISOString()
  await fse.writeJson(progressPath, progress, { spaces: 2 })

  console.log(`🔄 Resuming review: ${assignmentName}`)
  console.log(`   Gate: ${request.gate} | Phase: ${progress.phase}`)
  console.log(`   Progress: ${reviewed.length}/${total} files reviewed, ${progress.findings_so_far || 0} findings`)
  console.log('')

  if (reviewed.length > 0) {
    console.log('   Files already reviewed:')
    for (const f of reviewed) {
      console.log(`     ✅ ${f}`)
    }
    console.log('')
  }

  if (remaining.length > 0) {
    console.log('   Files remaining:')
    for (const f of remaining) {
      console.log(`     ⬚ ${f}`)
    }
    console.log('')
    console.log(`   Next: continue reviewing from ${remaining[0]}`)
  }

  // Check for partial report
  const reportPath = join(assignmentPath, 'review_report.md')
  if (await fse.pathExists(reportPath)) {
    console.log(`   📄 Partial report: ${reportPath}`)
  }
}

/**
 * specdev check accept [--notes="..."]
 */
async function checkAccept(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')

  if (!(await fse.pathExists(requestPath))) {
    console.error('❌ No review request found')
    process.exit(1)
  }

  const request = await fse.readJson(requestPath)

  if (request.status !== 'in_progress' && request.status !== 'awaiting_approval') {
    console.error(`❌ Review is not in progress (status: ${request.status})`)
    process.exit(1)
  }

  request.status = 'passed'
  request.completed_at = new Date().toISOString()
  if (flags.notes) request.reviewer_notes = flags.notes

  await fse.writeJson(requestPath, request, { spaces: 2 })

  const lockPath = join(assignmentPath, 'review_request.lock')
  await fse.remove(lockPath)

  // Update progress phase
  const progressPath = join(assignmentPath, 'review_progress.json')
  if (await fse.pathExists(progressPath)) {
    try {
      const progress = await fse.readJson(progressPath)
      progress.phase = 'done'
      progress.last_activity = new Date().toISOString()
      await fse.writeJson(progressPath, progress, { spaces: 2 })
    } catch { /* skip */ }
  }

  const assignmentName = assignmentPath.split(/[/\\]/).pop()
  console.log(`✅ Review passed: ${assignmentName}`)
  console.log(`   Gate: ${request.gate}`)

  if (request.gate === 'gate_3') {
    console.log('')
    console.log('   Next: implementer requests Gate 4 with:')
    console.log('   specdev work request --gate=gate_4')
  }
}

/**
 * specdev check reject --reason="..."
 */
async function checkReject(flags) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const requestPath = join(assignmentPath, 'review_request.json')

  if (!(await fse.pathExists(requestPath))) {
    console.error('❌ No review request found')
    process.exit(1)
  }

  const request = await fse.readJson(requestPath)

  if (request.status !== 'in_progress' && request.status !== 'awaiting_approval') {
    console.error(`❌ Review is not in progress (status: ${request.status})`)
    process.exit(1)
  }

  const reason = flags.reason || '(no reason provided)'

  request.status = 'failed'
  request.completed_at = new Date().toISOString()
  request.reviewer_notes = reason

  await fse.writeJson(requestPath, request, { spaces: 2 })

  const lockPath = join(assignmentPath, 'review_request.lock')
  await fse.remove(lockPath)

  const assignmentName = assignmentPath.split(/[/\\]/).pop()
  console.log(`❌ Review failed: ${assignmentName}`)
  console.log(`   Gate: ${request.gate}`)
  console.log(`   Reason: ${reason}`)
  console.log('')
  console.log('   Implementer should fix issues and re-request:')
  console.log(`   specdev work request --gate=${request.gate}`)
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
