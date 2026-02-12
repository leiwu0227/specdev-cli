import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'implementing', 'scripts')
const TEST_DIR = join(__dirname, 'test-implementing-output')

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
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup
cleanup()
mkdirSync(TEST_DIR, { recursive: true })

// ---- Test extract-tasks.sh ----
console.log('\nextract-tasks.sh:')

const extractScript = join(SCRIPTS_DIR, 'extract-tasks.sh')

const planContent = `# Implementation Plan

## Overview
A mock plan for testing.

### Task 1: Foo
- Create: \`path/to/file.js\`
- Modify: \`path/to/existing.js\`

### Task 2: Bar
- Create: \`src/bar.ts\`
- Test: \`tests/bar.test.ts\`
`

const planFile = join(TEST_DIR, 'plan.md')
writeFileSync(planFile, planContent)

const extractResult = spawnSync('bash', [extractScript, planFile], { encoding: 'utf-8' })
assert(extractResult.status === 0, 'exits with code 0')

let tasks
try {
  tasks = JSON.parse(extractResult.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + extractResult.stdout.substring(0, 100))
  tasks = []
}

assert(tasks.length === 2, 'has 2 tasks')
assert(tasks[0] && tasks[0].name.includes('Foo'), 'task 1 name contains "Foo"')

// Test with missing file arg
const extractBadResult = spawnSync('bash', [extractScript], { encoding: 'utf-8' })
assert(extractBadResult.status !== 0, 'exits non-zero with missing file arg')

// ---- Test track-progress.sh ----
console.log('\ntrack-progress.sh:')

const trackScript = join(SCRIPTS_DIR, 'track-progress.sh')

const trackPlanContent = `# Plan

### Task 1: Setup database
- Create: \`db/schema.sql\`

### Task 2: Build API
- Create: \`src/api.js\`
`

const trackPlanFile = join(TEST_DIR, 'track-plan.md')
writeFileSync(trackPlanFile, trackPlanContent)

// Mark task 1 as started
const startResult = spawnSync('bash', [trackScript, trackPlanFile, '1', 'started'], { encoding: 'utf-8' })
assert(startResult.status === 0, 'exits 0 when marking task started')
assert(startResult.stdout.includes('started'), 'output contains "started"')

// Verify progress file exists
const progressFile = trackPlanFile + '.progress.json'
assert(existsSync(progressFile), '.progress.json exists')

// Mark task 1 as completed
const completeResult = spawnSync('bash', [trackScript, trackPlanFile, '1', 'completed'], { encoding: 'utf-8' })
assert(completeResult.status === 0, 'exits 0 when marking task completed')
assert(completeResult.stdout.includes('completed'), 'output contains "completed"')

// Parse progress file and check task 1 status
let progressData
try {
  progressData = JSON.parse(readFileSync(progressFile, 'utf-8'))
  const task1 = progressData.tasks.find(t => t.number === 1)
  assert(task1 && task1.status === 'completed', 'task 1 status is "completed" in .progress.json')
} catch (e) {
  assert(false, 'task 1 status is "completed" in .progress.json — parse error: ' + e.message)
}

// Summary
const summaryResult = spawnSync('bash', [trackScript, trackPlanFile, 'summary'], { encoding: 'utf-8' })
assert(summaryResult.status === 0, 'summary exits 0')
assert(summaryResult.stdout.includes('1/2 completed'), 'summary contains "1/2 completed"')

// No args
const trackBadResult = spawnSync('bash', [trackScript], { encoding: 'utf-8' })
assert(trackBadResult.status !== 0, 'exits non-zero with no args')

// ---- Test poll-for-feedback.sh ----
console.log('\npoll-for-feedback.sh:')

const pollScript = join(SCRIPTS_DIR, 'poll-for-feedback.sh')

// Setup: create a mock assignment dir with review/ subdirectory
const assignmentDir = join(TEST_DIR, 'assignment')
mkdirSync(join(assignmentDir, 'review'), { recursive: true })

// Test timeout: run with 1-second timeout, no feedback file
const timeoutResult = spawnSync('bash', [pollScript, assignmentDir, 'breakdown', '1'], { encoding: 'utf-8', timeout: 30000 })
assert(timeoutResult.status !== 0, 'exits non-zero on timeout')
assert(timeoutResult.stderr.includes('timeout'), 'stderr contains "timeout"')

// Pre-create review-feedback.md with matching phase
writeFileSync(join(assignmentDir, 'review', 'review-feedback.md'), `**Phase:** breakdown

## Feedback
Looks good, proceed with implementation.
`)

// Run with matching phase and short timeout
const feedbackResult = spawnSync('bash', [pollScript, assignmentDir, 'breakdown', '2'], { encoding: 'utf-8', timeout: 30000 })
assert(feedbackResult.status === 0, 'exits 0 when feedback file exists with matching phase')
assert(feedbackResult.stdout.includes('Looks good'), 'stdout contains the feedback content')

// Bad args (no args)
const pollBadResult = spawnSync('bash', [pollScript], { encoding: 'utf-8' })
assert(pollBadResult.status !== 0, 'exits non-zero with bad args')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
