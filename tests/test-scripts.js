import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-scripts-output')
const WORKTREES_DIR = join(__dirname, 'test-scripts-output-worktrees')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) {
    spawnSync('git', ['worktree', 'prune'], { cwd: TEST_DIR })
  }
  if (existsSync(WORKTREES_DIR)) rmSync(WORKTREES_DIR, { recursive: true })
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// =====================================================================
// TDD Scripts (verify-tests.sh)
// =====================================================================

const TDD_SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'test-driven-development', 'scripts')

cleanup()
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
  name: 'test-tdd-project',
  version: '1.0.0',
  scripts: { test: 'echo "all tests passed" && exit 0' }
}))
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')

console.log('\nverify-tests.sh:')
const verifyScript = join(TDD_SCRIPTS_DIR, 'verify-tests.sh')

let result = spawnSync('bash', [verifyScript, TEST_DIR], { encoding: 'utf-8' })
assert(result.status === 0, 'exits with code 0')

let output
try {
  output = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 100))
  output = {}
}

assert(output.passed === true, 'reports tests passed')
assert(output.exit_code === 0, 'exit_code is 0')
assert(output.command === 'npm test', 'auto-detects npm test command')
assert(typeof output.output_summary === 'string', 'includes output_summary')

const explicitResult = spawnSync('bash', [verifyScript, TEST_DIR, 'echo hello'], { encoding: 'utf-8' })
assert(explicitResult.status === 0, 'exits 0 with explicit command')

let explicitOutput
try {
  explicitOutput = JSON.parse(explicitResult.stdout)
  assert(explicitOutput.command === 'echo hello', 'uses explicit command')
} catch (e) {
  assert(false, 'explicit command outputs valid JSON')
}

const failProject = join(TEST_DIR, 'fail-project')
mkdirSync(failProject, { recursive: true })
writeFileSync(join(failProject, 'package.json'), JSON.stringify({
  name: 'fail-project',
  scripts: { test: 'echo "test failed" && exit 1' }
}))

const failResult = spawnSync('bash', [verifyScript, failProject], { encoding: 'utf-8' })
assert(failResult.status === 0, 'exits 0 even when tests fail (status in JSON)')

let failOutput
try {
  failOutput = JSON.parse(failResult.stdout)
  assert(failOutput.passed === false, 'reports tests failed')
  assert(failOutput.exit_code === 1, 'exit_code is 1 for failing tests')
} catch (e) {
  assert(false, 'failing test outputs valid JSON')
}

const badResult = spawnSync('bash', [verifyScript, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

// =====================================================================
// Implementing Scripts (extract-tasks.sh, track-progress.sh)
// =====================================================================

const IMPL_SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'implementing', 'scripts')

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

console.log('\nextract-tasks.sh:')
const extractScript = join(IMPL_SCRIPTS_DIR, 'extract-tasks.sh')

const planContent = `# Implementation Plan

## Overview
A mock plan for testing.

### Task 1: Foo
**Mode:** lightweight
- Create: \`path/to/file.js\`
- Modify: \`path/to/existing.js\`

### Task 2: Bar
- Create: \`src/bar.ts\`
- Test: \`tests/bar.test.ts\`
`

const planFile = join(TEST_DIR, 'plan.md')
writeFileSync(planFile, planContent)

const extractResult = spawnSync('bash', [extractScript, planFile], { encoding: 'utf-8' })
assert(extractResult.status === 0, 'extract exits with code 0')

let tasks
try {
  tasks = JSON.parse(extractResult.stdout)
  assert(true, 'extract outputs valid JSON')
} catch (e) {
  assert(false, 'extract outputs valid JSON — got: ' + extractResult.stdout.substring(0, 100))
  tasks = []
}

assert(tasks.length === 2, 'has 2 tasks')
assert(tasks[0] && tasks[0].name.includes('Foo'), 'task 1 name contains "Foo"')
assert(tasks[0] && tasks[0].mode === 'lightweight', 'task 1 mode parsed as lightweight')
assert(tasks[1] && tasks[1].mode === 'full', 'task 2 mode defaults to full')

const extractBadResult = spawnSync('bash', [extractScript], { encoding: 'utf-8' })
assert(extractBadResult.status !== 0, 'extract exits non-zero with missing file arg')

console.log('\ntrack-progress.sh:')
const trackScript = join(IMPL_SCRIPTS_DIR, 'track-progress.sh')

const trackPlanContent = `# Plan

### Task 1: Setup database
- Create: \`db/schema.sql\`

### Task 2: Build API
- Create: \`src/api.js\`
`

const trackAssignmentDir = join(TEST_DIR, 'assignment-progress')
mkdirSync(join(trackAssignmentDir, 'breakdown'), { recursive: true })
const trackPlanFile = join(trackAssignmentDir, 'breakdown', 'plan.md')
writeFileSync(trackPlanFile, trackPlanContent)

const startResult = spawnSync('bash', [trackScript, trackPlanFile, '1', 'started'], { encoding: 'utf-8' })
assert(startResult.status === 0, 'track exits 0 when marking task started')
assert(startResult.stdout.includes('started'), 'track output contains "started"')

const progressFile = join(trackAssignmentDir, 'implementation', 'progress.json')
assert(existsSync(progressFile), 'progress.json exists')

const completeResult = spawnSync('bash', [trackScript, trackPlanFile, '1', 'completed'], { encoding: 'utf-8' })
assert(completeResult.status === 0, 'track exits 0 when marking task completed')
assert(completeResult.stdout.includes('completed'), 'track output contains "completed"')

let progressData
try {
  progressData = JSON.parse(readFileSync(progressFile, 'utf-8'))
  const task1 = progressData.tasks.find(t => t.number === 1)
  assert(task1 && task1.status === 'completed', 'task 1 status is "completed" in progress.json')
} catch (e) {
  assert(false, 'task 1 status is "completed" in progress.json — parse error: ' + e.message)
}

const summaryResult = spawnSync('bash', [trackScript, trackPlanFile, 'summary'], { encoding: 'utf-8' })
assert(summaryResult.status === 0, 'summary exits 0')
try {
  const summaryData = JSON.parse(readFileSync(progressFile, 'utf-8'))
  const completedCount = summaryData.tasks.filter(t => t.status === 'completed').length
  assert(completedCount === 1 && summaryData.total_tasks === 2, 'summary state reflects "1/2 completed"')
} catch (e) {
  assert(false, 'summary state reflects "1/2 completed" — parse error: ' + e.message)
}

const trackBadResult = spawnSync('bash', [trackScript], { encoding: 'utf-8' })
assert(trackBadResult.status !== 0, 'track exits non-zero with no args')

// =====================================================================
// Review Agent Scripts (poll-for-feedback.sh)
// =====================================================================

const REVIEW_SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'review-agent', 'scripts')

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

const POLL_SCRIPT = join(REVIEW_SCRIPTS_DIR, 'poll-for-feedback.sh')
const ASSIGNMENT_DIR = join(TEST_DIR, 'assignment')
const REVIEW_DIR = join(ASSIGNMENT_DIR, 'review')

mkdirSync(REVIEW_DIR, { recursive: true })

const FEEDBACK_CONTENT_IMPL = `# Review Feedback

**Phase:** implementation
**Verdict:** approved
**Round:** 1
**Timestamp:** 2025-01-15T10:35:00

## Findings
- None — approved
`

const FEEDBACK_CONTENT_BREAKDOWN = `# Review Feedback

**Phase:** breakdown
**Verdict:** approved
**Round:** 1
**Timestamp:** 2025-01-15T10:35:00

## Findings
- None — approved
`

console.log('\npoll-for-feedback.sh — bad args:')
const badArgsResult = spawnSync('bash', [POLL_SCRIPT], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(badArgsResult.status !== 0, 'poll exits non-zero with no arguments')

console.log('\npoll-for-feedback.sh — timeout (no file):')
const timeoutResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '1'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(timeoutResult.status !== 0, 'poll exits non-zero on timeout')
assert(timeoutResult.stderr.includes('timeout'), 'poll stderr contains timeout message')

console.log('\npoll-for-feedback.sh — wrong phase:')
writeFileSync(join(REVIEW_DIR, 'implementation-feedback.md'), FEEDBACK_CONTENT_IMPL)
const wrongPhaseResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '1'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(wrongPhaseResult.status !== 0, 'poll exits non-zero when phase does not match')

console.log('\npoll-for-feedback.sh — correct phase:')
writeFileSync(join(REVIEW_DIR, 'breakdown-feedback.md'), FEEDBACK_CONTENT_BREAKDOWN)
const correctResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '2'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(correctResult.status === 0, 'poll exits 0 when phase matches')
assert(correctResult.stdout.includes('Review Feedback'), 'poll stdout contains feedback content')

// =====================================================================
// Parallel Worktrees Scripts (setup-worktree.sh)
// =====================================================================

const WORKTREE_SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'parallel-worktrees', 'scripts')

cleanup()
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), '{"name": "worktree-test"}')
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')

spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

console.log('\nsetup-worktree.sh:')
const worktreeScript = join(WORKTREE_SCRIPTS_DIR, 'setup-worktree.sh')

const worktreeResult = spawnSync('bash', [worktreeScript, TEST_DIR, 'task-one'], { encoding: 'utf-8' })
assert(worktreeResult.status === 0, 'worktree exits with code 0')

let worktreeOutput
try {
  worktreeOutput = JSON.parse(worktreeResult.stdout)
  assert(true, 'worktree outputs valid JSON')
} catch (e) {
  assert(false, 'worktree outputs valid JSON — got: ' + worktreeResult.stdout.substring(0, 100))
  worktreeOutput = {}
}

assert(worktreeOutput.task_name === 'task-one', 'has correct task_name')
assert(worktreeOutput.branch === 'worktree/task-one', 'has correct branch name')
assert(typeof worktreeOutput.worktree_path === 'string' && worktreeOutput.worktree_path.length > 0, 'has worktree_path')
assert(typeof worktreeOutput.base_branch === 'string' && worktreeOutput.base_branch.length > 0, 'has base_branch')

if (worktreeOutput.worktree_path) {
  assert(existsSync(worktreeOutput.worktree_path), 'worktree directory exists')
  assert(existsSync(join(worktreeOutput.worktree_path, 'package.json')), 'worktree has project files')
}

const wtBadResult = spawnSync('bash', [worktreeScript, '/nonexistent', 'task-two'], { encoding: 'utf-8' })
assert(wtBadResult.status !== 0, 'worktree exits non-zero for missing directory')

const noTask = spawnSync('bash', [worktreeScript, TEST_DIR], { encoding: 'utf-8' })
assert(noTask.status !== 0, 'worktree exits non-zero for missing task name')

if (worktreeOutput.worktree_path && existsSync(worktreeOutput.worktree_path)) {
  spawnSync('git', ['worktree', 'remove', worktreeOutput.worktree_path, '--force'], { cwd: TEST_DIR })
}

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
