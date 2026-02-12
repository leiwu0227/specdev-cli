import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'gate-coordination', 'scripts')
const TEST_DIR = join(__dirname, 'test-gate-coordination-output')

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

// Setup: create a mock assignment inside a git repo
cleanup()
const assignmentDir = join(TEST_DIR, '00001_feature_test')
mkdirSync(assignmentDir, { recursive: true })
writeFileSync(join(assignmentDir, 'proposal.md'), '# Proposal')

// Init git repo for HEAD commit detection
spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test request-review.sh ----
console.log('\nrequest-review.sh:')

const requestScript = join(SCRIPTS_DIR, 'request-review.sh')

// Request gate_3 review
const result = spawnSync('bash', [requestScript, assignmentDir, 'gate_3', 'Ready for review'], {
  encoding: 'utf-8', cwd: TEST_DIR
})
assert(result.status === 0, 'exits with code 0')

const requestFile = join(assignmentDir, 'review_request.json')
assert(existsSync(requestFile), 'creates review_request.json')

let request
try {
  request = JSON.parse(readFileSync(requestFile, 'utf-8'))
  assert(true, 'review_request.json is valid JSON')
} catch (e) {
  assert(false, 'review_request.json is valid JSON')
  request = {}
}

assert(request.version === '1', 'has version field')
assert(request.assignment_id === '00001_feature_test', 'has correct assignment_id')
assert(request.gate === 'gate_3', 'has correct gate')
assert(request.status === 'pending', 'status is pending')
assert(typeof request.requested_at === 'string' && request.requested_at.length > 0, 'has requested_at timestamp')
assert(typeof request.head_commit === 'string', 'has head_commit')
assert(request.notes === 'Ready for review', 'includes notes')

// Test invalid gate
const badGate = spawnSync('bash', [requestScript, assignmentDir, 'gate_99'], {
  encoding: 'utf-8', cwd: TEST_DIR
})
assert(badGate.status !== 0, 'exits non-zero for invalid gate')

// Test missing args
const noArgs = spawnSync('bash', [requestScript], { encoding: 'utf-8', cwd: TEST_DIR })
assert(noArgs.status !== 0, 'exits non-zero with no args')

// ---- Test poll-review.sh ----
console.log('\npoll-review.sh:')

const pollScript = join(SCRIPTS_DIR, 'poll-review.sh')

// Poll existing review
const pollResult = spawnSync('bash', [pollScript, assignmentDir], { encoding: 'utf-8' })
assert(pollResult.status === 0, 'exits with code 0')

let pollOutput
try {
  pollOutput = JSON.parse(pollResult.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + pollResult.stdout.substring(0, 100))
  pollOutput = {}
}

assert(pollOutput.status === 'pending', 'shows pending status')
assert(pollOutput.gate === 'gate_3', 'shows correct gate')
assert(pollOutput.assignment_id === '00001_feature_test', 'shows correct assignment_id')

// Test with no review_request.json
const noReviewDir = join(TEST_DIR, 'no-review')
mkdirSync(noReviewDir, { recursive: true })
const noReviewResult = spawnSync('bash', [pollScript, noReviewDir], { encoding: 'utf-8' })
assert(noReviewResult.status !== 0, 'exits non-zero when no review_request.json')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
