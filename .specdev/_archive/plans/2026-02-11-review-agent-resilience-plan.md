# Review Agent Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fragile 8-subcommand review system with two resilient commands (`specdev work`, `specdev check`) backed by checkpoint files for crash recovery.

**Architecture:** Two new command modules (`work.js`, `check.js`) replace `review.js`. Both read/write checkpoint files (`review_request.json`, `review_progress.json`) and return immediately (non-blocking). The skill guide and templates are updated to match.

**Tech Stack:** Node.js (ES modules), fs-extra, raw Node.js test framework (spawnSync + assert pattern)

**Design doc:** `docs/plans/2026-02-11-review-agent-resilience-design.md`

---

### Task 1: Create `src/commands/work.js` — implementer command

**Files:**
- Create: `src/commands/work.js`
- Reference: `src/utils/scan.js` (findLatestAssignment)

**Step 1: Write the failing test**

Add to a new test file `tests/test-work.js`:

```javascript
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-work-output'

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Setup: init project + create assignment with plan/proposal
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) {
    console.error('❌ setup failed: specdev init')
    process.exit(1)
  }

  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test-work')
  mkdirSync(assignment, { recursive: true })
  writeFileSync(join(assignment, 'plan.md'), '# Plan\n\n**Complexity: LOW**\n')
  writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')

  // Test 1: work request creates review_request.json
  console.log('work request:')
  const req = runCmd([
    './bin/specdev.js', 'work', 'request',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
    '--gate=gate_3',
  ])
  if (!assert(req.status === 0, 'creates a review request')) failures++

  const requestPath = join(assignment, 'review_request.json')
  if (!assert(existsSync(requestPath), 'review_request.json exists')) failures++

  const reviewReq = JSON.parse(readFileSync(requestPath, 'utf-8'))
  if (!assert(reviewReq.status === 'pending', 'status is pending')) failures++
  if (!assert(
    reviewReq.assignment_path === '.specdev/assignments/00001_feature_test-work',
    'writes project-relative assignment_path'
  )) failures++

  // Test 2: work status shows current state
  console.log('\nwork status:')
  const status = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(status.status === 0, 'status returns success')) failures++
  if (!assert(status.stdout.includes('pending'), 'status output shows pending')) failures++

  // Test 3: work status with mode flag
  console.log('\nwork request with mode:')
  // Remove existing request first
  rmSync(requestPath)
  const reqMode = runCmd([
    './bin/specdev.js', 'work', 'request',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
    '--gate=gate_3',
    '--mode=manual',
  ])
  if (!assert(reqMode.status === 0, 'creates request with mode flag')) failures++
  const reqWithMode = JSON.parse(readFileSync(requestPath, 'utf-8'))
  if (!assert(reqWithMode.mode === 'manual', 'mode is stored in request')) failures++

  // Test 4: work status detects passed review
  console.log('\nwork status after pass:')
  const passedReq = { ...reqWithMode, status: 'passed', completed_at: new Date().toISOString() }
  writeFileSync(requestPath, JSON.stringify(passedReq, null, 2))
  const statusPassed = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(statusPassed.status === 0, 'status returns success for passed review')) failures++
  if (!assert(statusPassed.stdout.includes('passed'), 'status shows passed')) failures++

  // Test 5: work status detects failed review (exits non-zero)
  console.log('\nwork status after fail:')
  const failedReq = { ...reqWithMode, status: 'failed', reviewer_notes: 'missing tests', completed_at: new Date().toISOString() }
  writeFileSync(requestPath, JSON.stringify(failedReq, null, 2))
  const statusFailed = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(statusFailed.status === 1, 'status exits non-zero for failed review')) failures++
  if (!assert(statusFailed.stdout.includes('failed'), 'status shows failed')) failures++

  cleanup()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} work test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All work tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-work.js`
Expected: FAIL — `specdev work` command not found

**Step 3: Write minimal implementation**

Create `src/commands/work.js`:

```javascript
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

  let headCommit = ''
  try {
    headCommit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch { /* not in git repo */ }

  let changedFiles = []
  try {
    const diff = execSync('git diff --name-only HEAD~1', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (diff) changedFiles = diff.split('\n').filter(Boolean)
  } catch { /* can't get diff */ }

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
```

**Step 4: Wire into CLI router**

In `bin/specdev.js`, add the import and case:

```javascript
// Add import at top:
import { workCommand } from '../src/commands/work.js'

// Add case in switch:
  case 'work': {
    const workSub = positionalArgs[0]
    await workCommand(workSub, flags)
    break
  }
```

**Step 5: Run test to verify it passes**

Run: `node tests/test-work.js`
Expected: PASS — all 8 assertions pass

**Step 6: Commit**

```bash
git add src/commands/work.js tests/test-work.js bin/specdev.js
git commit -m "feat: add specdev work command (implementer side)"
```

---

### Task 2: Create `src/commands/check.js` — reviewer command

**Files:**
- Create: `src/commands/check.js`
- Reference: `src/utils/scan.js` (findLatestAssignment, scanAssignments)
- Reference: `scripts/verify-gates.sh`

**Step 1: Write the failing test**

Create `tests/test-check.js`:

```javascript
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-check-output'

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function runShell(cmd) {
  return spawnSync('bash', ['-lc', cmd], { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) {
    console.error('❌ setup failed')
    process.exit(1)
  }

  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test-check')
  mkdirSync(assignment, { recursive: true })
  writeFileSync(join(assignment, 'plan.md'), '# Plan\n\n**Complexity: LOW**\n')
  writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')

  // Test 1: check status with no pending review
  console.log('check status (no review):')
  const noReview = runCmd([
    './bin/specdev.js', 'check', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(noReview.status === 0, 'returns success when no reviews pending')) failures++
  if (!assert(noReview.stdout.includes('No pending'), 'reports no pending reviews')) failures++

  // Test 2: check status finds pending review
  console.log('\ncheck status (pending review):')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1,
    assignment_id: '00001',
    assignment_path: '.specdev/assignments/00001_feature_test-check',
    gate: 'gate_3',
    status: 'pending',
    mode: 'auto',
    timestamp: new Date().toISOString(),
    changed_files: ['src/foo.js'],
  }, null, 2))

  const pending = runCmd([
    './bin/specdev.js', 'check', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(pending.status === 0, 'returns success for pending review')) failures++
  if (!assert(pending.stdout.includes('pending'), 'shows pending status')) failures++
  if (!assert(pending.stdout.includes('00001'), 'shows assignment id')) failures++

  // Test 3: check run triggers preflight (should fail — missing structural files)
  console.log('\ncheck run (preflight failure):')
  const run = runCmd([
    './bin/specdev.js', 'check', 'run',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(run.status === 1, 'exits non-zero when preflight fails', run.stdout + run.stderr)) failures++
  // Status should stay pending after preflight failure
  const afterRun = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(afterRun.status === 'pending', 'status stays pending after preflight failure')) failures++
  // Lock file should be cleaned up
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock file removed on failure')) failures++

  // Test 4: check accept (from in_progress)
  console.log('\ncheck accept:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const accept = runCmd([
    './bin/specdev.js', 'check', 'accept',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--notes=looks good',
  ])
  if (!assert(accept.status === 0, 'accept returns success')) failures++
  const accepted = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(accepted.status === 'passed', 'status is passed after accept')) failures++
  if (!assert(accepted.reviewer_notes === 'looks good', 'reviewer notes stored')) failures++
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock removed after accept')) failures++

  // Test 5: check reject (from in_progress)
  console.log('\ncheck reject:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const reject = runCmd([
    './bin/specdev.js', 'check', 'reject',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--reason=missing error handling',
  ])
  if (!assert(reject.status === 0, 'reject returns success')) failures++
  const rejected = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(rejected.status === 'failed', 'status is failed after reject')) failures++
  if (!assert(rejected.reviewer_notes === 'missing error handling', 'rejection reason stored')) failures++

  // Test 6: check resume with progress file
  console.log('\ncheck resume:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_progress.json'), JSON.stringify({
    phase: 'reviewing',
    mode: 'auto',
    started_at: new Date().toISOString(),
    last_activity: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    files_total: 4,
    files_reviewed: ['src/foo.js', 'src/bar.js'],
    files_remaining: ['src/baz.js', 'tests/test.js'],
    findings_so_far: 1,
  }, null, 2))

  const resume = runCmd([
    './bin/specdev.js', 'check', 'resume',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(resume.status === 0, 'resume returns success')) failures++
  if (!assert(resume.stdout.includes('2/4'), 'resume shows progress')) failures++
  if (!assert(resume.stdout.includes('src/baz.js'), 'resume shows remaining files')) failures++

  cleanup()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} check test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All check tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-check.js`
Expected: FAIL — `specdev check` command not found

**Step 3: Write minimal implementation**

Create `src/commands/check.js`:

```javascript
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
```

**Step 4: Wire into CLI router**

In `bin/specdev.js`, add the import and case:

```javascript
// Add import at top:
import { checkCommand } from '../src/commands/check.js'

// Add case in switch:
  case 'check': {
    const checkSub = positionalArgs[0]
    await checkCommand(checkSub, flags)
    break
  }
```

**Step 5: Run test to verify it passes**

Run: `node tests/test-check.js`
Expected: PASS — all assertions pass

**Step 6: Commit**

```bash
git add src/commands/check.js tests/test-check.js bin/specdev.js
git commit -m "feat: add specdev check command (reviewer side)"
```

---

### Task 3: Delete `src/commands/review.js` and update references

**Files:**
- Delete: `src/commands/review.js`
- Modify: `bin/specdev.js:9,44-48` (remove review import and case)
- Modify: `src/commands/help.js` (replace review docs with work/check docs)
- Modify: `tests/verify-output.js` (remove review.js from required files if listed)
- Delete: `tests/test-review.js`

**Step 1: Write the failing test**

Update `tests/verify-output.js` — ensure it does NOT require `review.js` but DOES require `work.js` and `check.js`. Also update help text test expectations.

In `tests/test-work.js` add a help text assertion:

```javascript
  // Test: help text documents work and check commands
  console.log('\nhelp text:')
  const helpSource = readFileSync('./src/commands/help.js', 'utf-8')
  if (!assert(
    helpSource.includes('work <sub>') && helpSource.includes('check <sub>'),
    'help documents work and check commands'
  )) failures++
  if (!assert(
    !helpSource.includes('review <sub>'),
    'help no longer documents review command'
  )) failures++
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-work.js`
Expected: FAIL — help.js still has `review <sub>`

**Step 3: Implement the changes**

Update `bin/specdev.js` — remove the review import and case:

```javascript
// Remove this line:
import { reviewCommand } from '../src/commands/review.js'

// Remove this case:
  case 'review': { ... }
```

Update `src/commands/help.js` — replace review section with work/check:

```javascript
export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Workflow System Initializer

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
  skills              List available .specdev skills in this project
  work <sub>          Implementer commands (request|status)
  check <sub>         Reviewer commands (status|run|resume|accept|reject)
  ponder workflow     Interactive: review & write workflow feedback
  ponder project      Interactive: review & write local project knowledge
  help                Show this help message
  --version, -v       Show version number

OPTIONS:
  --force, -f       Overwrite existing .specdev folder
  --dry-run         Show what would be copied without copying
  --target=<path>   Specify target directory (default: current directory)

EXAMPLES:
  # Initialize in current directory
  specdev init

  # Request a review (implementer)
  specdev work request --gate=gate_3
  specdev work request --gate=gate_3 --mode=manual

  # Check review status (implementer)
  specdev work status

  # Scan for pending reviews (reviewer)
  specdev check status

  # Start reviewing (reviewer)
  specdev check run

  # Resume interrupted review (reviewer)
  specdev check resume

  # Accept or reject (reviewer)
  specdev check accept --notes="looks good"
  specdev check reject --reason="missing tests"

  # Reflect on workflow and capture observations
  specdev ponder workflow

  # Reflect on project and capture knowledge
  specdev ponder project

QUICK START:
  npm install -g github:leiwu0227/specdev-cli
  specdev init

For more information, visit: https://github.com/leiwu0227/specdev-cli
`)
}
```

Delete old files:
```bash
rm src/commands/review.js tests/test-review.js
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests pass (test-review.js no longer in test suite)

**Step 5: Update `package.json` test scripts**

Replace `test:review` with `test:work` and add `test:check`:

```json
"test": "npm run test:init && npm run test:verify && npm run test:scan && npm run test:work && npm run test:check && npm run test:cleanup",
"test:work": "node ./tests/test-work.js",
"test:check": "node ./tests/test-check.js",
"test:cleanup": "rm -rf ./test-output ./test-manual ./test-scan-output ./test-work-output ./test-check-output"
```

Remove the `test:review` line.

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace specdev review with specdev work/check commands"
```

---

### Task 4: Update skill guide and templates

**Files:**
- Modify: `templates/.specdev/skills/review-agent.md` (rewrite for work/check)
- Modify: `templates/.specdev/_guides/task/validation_guide.md` (update review references)
- Modify: `templates/.specdev/skills/README.md` (update skill description)
- Modify: `templates/.specdev/_templates/review_report_template.md` (add incremental structure)

**Step 1: Rewrite `templates/.specdev/skills/review-agent.md`**

Replace all `specdev review` references with `specdev work`/`specdev check`. Add checkpoint protocol documentation. Add the incremental review_report.md template. Update starter prompts for both sessions.

Key changes:
- CLI reference table: replace 8 commands with work/check subcommands
- Automated mode: `specdev check run` (not `watch`) + agent manages polling
- Manual mode: reviewer pauses at `awaiting_approval`
- Resume section: `specdev check resume` replaces `specdev review pause`
- Checkpoint protocol: document `review_progress.json` and incremental report
- Starter prompt for reviewer: mention `specdev check status` then `specdev check run`

**Step 2: Update `templates/.specdev/_guides/task/validation_guide.md`**

Replace:
- `specdev review request` → `specdev work request`
- `specdev review wait` → `specdev work status`
- `specdev review watch` → `specdev check status` / `specdev check run`
- Any other `specdev review` references

**Step 3: Update `templates/.specdev/_templates/review_report_template.md`**

Add the incremental structure with "Files Reviewed" / "Files Not Yet Reviewed" / "Verdict: PENDING" sections.

**Step 4: Update `templates/.specdev/skills/README.md`**

Change the `review-agent.md` description to reflect work/check commands.

**Step 5: Run full test suite**

Run: `npm test`
Expected: PASS (verify-output.js checks these template files exist)

**Step 6: Commit**

```bash
git add templates/
git commit -m "docs: update skill guide and templates for work/check commands"
```

---

### Task 5: Update `review_request_schema.json` and `verify-gates.sh`

**Files:**
- Modify: `templates/.specdev/_templates/review_request_schema.json` (add mode, awaiting_approval, proposed_verdict)
- Modify: `scripts/verify-gates.sh` (update status enum validation)

**Step 1: Update schema**

In `review_request_schema.json`:
- Add `mode` field: enum `["auto", "manual"]`
- Add `awaiting_approval` to status enum
- Add `proposed_verdict` field: string

**Step 2: Update verify-gates.sh**

In the Gate 3 validation section, update the status check:

```bash
# Update status validation to include awaiting_approval
echo "$json" | node -e "
  const j = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const valid = ['pending','in_progress','passed','failed','awaiting_approval'];
  if (!valid.includes(j.status)) process.exit(1);
" || { fail "status not in valid enum"; }
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add templates/.specdev/_templates/review_request_schema.json scripts/verify-gates.sh
git commit -m "feat: update schema and preflight for mode/awaiting_approval"
```

---

### Task 6: End-to-end integration test

**Files:**
- Create: add end-to-end scenario to `tests/test-check.js`

**Step 1: Add integration test**

Append to `tests/test-check.js` — a full cycle test:

```javascript
  // Integration: full work → check cycle
  console.log('\nintegration: full cycle')
  cleanup()
  const init2 = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const a = join(TEST_DIR, '.specdev/assignments/00001_feature_e2e')
  mkdirSync(a, { recursive: true })
  writeFileSync(join(a, 'plan.md'), '# Plan\n\n**Complexity: LOW**\n')
  writeFileSync(join(a, 'proposal.md'), '# Proposal\n')
  writeFileSync(join(a, 'implementation.md'), '| T001 | done |\n')
  writeFileSync(join(a, 'validation_checklist.md'), '# Checklist\n')
  mkdirSync(join(a, 'context'), { recursive: true })
  mkdirSync(join(a, 'tasks'), { recursive: true })
  writeFileSync(join(a, 'skills_invoked.md'), '| Skill | Trigger |\n')

  // Implementer requests
  const workReq = runCmd([
    './bin/specdev.js', 'work', 'request',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_e2e', '--gate=gate_3',
  ])
  if (!assert(workReq.status === 0, 'e2e: work request succeeds')) failures++

  // Implementer checks — pending
  const workSt = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_e2e',
  ])
  if (!assert(workSt.stdout.includes('pending'), 'e2e: implementer sees pending')) failures++

  // Reviewer sees pending
  const checkSt = runCmd([
    './bin/specdev.js', 'check', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(checkSt.stdout.includes('pending'), 'e2e: reviewer sees pending')) failures++

  // Reviewer accepts (skip preflight for e2e by setting in_progress manually)
  const reqPath = join(a, 'review_request.json')
  const r = JSON.parse(readFileSync(reqPath, 'utf-8'))
  r.status = 'in_progress'
  writeFileSync(reqPath, JSON.stringify(r, null, 2))
  writeFileSync(join(a, 'review_request.lock'), new Date().toISOString())

  const acc = runCmd([
    './bin/specdev.js', 'check', 'accept',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_e2e', '--notes=all good',
  ])
  if (!assert(acc.status === 0, 'e2e: check accept succeeds')) failures++

  // Implementer sees passed
  const workFinal = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_e2e',
  ])
  if (!assert(workFinal.stdout.includes('passed'), 'e2e: implementer sees passed')) failures++
```

**Step 2: Run tests**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/test-check.js
git commit -m "test: add end-to-end integration test for work/check cycle"
```
