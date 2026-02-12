import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'subagent-dispatch', 'scripts')
const TEST_DIR = join(__dirname, 'test-subagent-dispatch-output')

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

// Setup: create a mock assignment
cleanup()
const assignmentDir = join(TEST_DIR, '00001_feature_test')
mkdirSync(assignmentDir, { recursive: true })

// Create a progress file to simulate task tracking
writeFileSync(join(assignmentDir, 'plan.md.progress.json'), JSON.stringify({
  plan_file: 'plan.md',
  total_tasks: 3,
  tasks: [
    { number: 1, status: 'completed', started_at: '2025-01-01T00:00:00', completed_at: '2025-01-01T01:00:00' },
    { number: 2, status: 'completed', started_at: '2025-01-01T01:00:00', completed_at: '2025-01-01T02:00:00' },
    { number: 3, status: 'pending', started_at: null, completed_at: null }
  ]
}))

// Init git repo for commit detection
spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test checkpoint.sh ----
console.log('\ncheckpoint.sh:')

const script = join(SCRIPTS_DIR, 'checkpoint.sh')

// Test save
const saveResult = spawnSync('bash', [script, 'save', assignmentDir], { encoding: 'utf-8', cwd: TEST_DIR })
assert(saveResult.status === 0, 'save exits with code 0')

const checkpointFile = join(assignmentDir, 'checkpoint.json')
assert(existsSync(checkpointFile), 'creates checkpoint.json')

let checkpoint
try {
  checkpoint = JSON.parse(readFileSync(checkpointFile, 'utf-8'))
  assert(true, 'checkpoint.json is valid JSON')
} catch (e) {
  assert(false, 'checkpoint.json is valid JSON')
  checkpoint = {}
}

assert(checkpoint.completed_tasks === 2, 'tracks 2 completed tasks')
assert(checkpoint.total_tasks === 3, 'tracks 3 total tasks')
assert(checkpoint.saves === 1, 'save count is 1')
assert(typeof checkpoint.updated_at === 'string', 'has updated_at timestamp')

// Test status (with existing checkpoint)
const statusResult = spawnSync('bash', [script, 'status', assignmentDir], { encoding: 'utf-8' })
assert(statusResult.status === 0, 'status exits with code 0')

let statusOutput
try {
  statusOutput = JSON.parse(statusResult.stdout)
  assert(statusOutput.exists === true, 'status shows checkpoint exists')
} catch (e) {
  assert(false, 'status outputs valid JSON')
}

// Test restore
const restoreResult = spawnSync('bash', [script, 'restore', assignmentDir], { encoding: 'utf-8' })
assert(restoreResult.status === 0, 'restore exits with code 0')
assert(restoreResult.stdout.includes('2') && restoreResult.stdout.includes('3'), 'restore shows progress')
assert(restoreResult.stdout.includes('Checkpoint') || restoreResult.stdout.includes('Resume'), 'restore shows resume info')

// Test status with no checkpoint
const emptyDir = join(TEST_DIR, 'empty-assignment')
mkdirSync(emptyDir, { recursive: true })
const noCheckpoint = spawnSync('bash', [script, 'status', emptyDir], { encoding: 'utf-8' })
assert(noCheckpoint.status === 0, 'status exits 0 even with no checkpoint')

let noCheckpointOutput
try {
  noCheckpointOutput = JSON.parse(noCheckpoint.stdout)
  assert(noCheckpointOutput.exists === false, 'status shows no checkpoint')
} catch (e) {
  assert(false, 'no checkpoint status outputs valid JSON')
}

// Test bad args
const badResult = spawnSync('bash', [script], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero with no args')

const badAction = spawnSync('bash', [script, 'invalid', assignmentDir], { encoding: 'utf-8' })
assert(badAction.status !== 0, 'exits non-zero for invalid action')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
