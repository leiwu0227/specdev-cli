import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'review-agent', 'scripts')
const TEST_DIR = join(__dirname, 'test-review-agent-output')

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

cleanup()

const POLL_SCRIPT = join(SCRIPTS_DIR, 'poll-for-feedback.sh')
const ASSIGNMENT_DIR = join(TEST_DIR, 'assignment')
const REVIEW_DIR = join(ASSIGNMENT_DIR, 'review')

// Create mock assignment directory structure
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

// ---- Test: bad args (no arguments) ----
console.log('\npoll-for-feedback.sh — bad args:')

const badArgsResult = spawnSync('bash', [POLL_SCRIPT], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(badArgsResult.status !== 0, 'exits non-zero with no arguments')

// ---- Test: timeout when no feedback file exists ----
console.log('\npoll-for-feedback.sh — timeout (no file):')

const timeoutResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '1'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(timeoutResult.status !== 0, 'exits non-zero on timeout')
assert(timeoutResult.stderr.includes('timeout'), 'stderr contains timeout message')

// ---- Test: wrong phase ----
console.log('\npoll-for-feedback.sh — wrong phase:')

writeFileSync(join(REVIEW_DIR, 'review-feedback.md'), FEEDBACK_CONTENT_IMPL)

const wrongPhaseResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '1'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(wrongPhaseResult.status !== 0, 'exits non-zero when phase does not match')

// ---- Test: correct phase ----
console.log('\npoll-for-feedback.sh — correct phase:')

writeFileSync(join(REVIEW_DIR, 'review-feedback.md'), FEEDBACK_CONTENT_BREAKDOWN)

const correctResult = spawnSync('bash', [POLL_SCRIPT, ASSIGNMENT_DIR, 'breakdown', '2'], {
  encoding: 'utf-8',
  timeout: 10000
})
assert(correctResult.status === 0, 'exits 0 when phase matches')
assert(correctResult.stdout.includes('Review Feedback'), 'stdout contains feedback content')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
