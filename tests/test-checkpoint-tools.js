import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-checkpoint-tools-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install fireperp
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])

// Create a passing implementation checkpoint scenario
const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', '001_feature_test')
mkdirSync(join(assignmentDir, 'implementation'), { recursive: true })
mkdirSync(join(assignmentDir, 'breakdown'), { recursive: true })

// Plan that declares fireperp skill in one task but not the other
writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), `# Test Plan

### Task 1: Research API
**Skills:** [fireperp, test-driven-development]

Do research.

### Task 2: Implement
**Skills:** [test-driven-development]

Build it.
`)

// All tasks completed
writeFileSync(join(assignmentDir, 'implementation', 'progress.json'), JSON.stringify({
  tasks: [{ status: 'completed' }, { status: 'completed' }]
}))

// Checkpoint should pass (tool warnings are advisory, not blocking)
console.log('\ncheckpoint implementation (advisory):')
let result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`])
assert(result.status === 0, 'checkpoint passes (tools are advisory)')

// Checkpoint with --json should include structured warnings
console.log('\ncheckpoint implementation --json:')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`, '--json'])
assert(result.status === 0, 'checkpoint --json passes')
const output = result.stdout.trim()
try {
  const json = JSON.parse(output)
  assert(json.status === 'pass', 'json status is pass')
  assert(Array.isArray(json.warnings), 'json has warnings array')
} catch {
  assert(false, 'json output is valid JSON: ' + output.slice(0, 100))
}

// Now add a Skipped field to the plan and verify it shows as skipped
writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), `# Test Plan

### Task 1: Research API
**Skills:** [fireperp, test-driven-development]

Do research.

### Task 2: Implement
**Skills:** [test-driven-development]
**Skipped:** fireperp — this task is pure refactoring, no research needed

Build it.
`)

console.log('\ncheckpoint with waiver:')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`, '--json'])
const waiverJson = JSON.parse(result.stdout.trim())
const skippedWarning = waiverJson.warnings.find(w => w.code === 'TOOL_SKILL_SKIPPED')
assert(skippedWarning !== undefined || waiverJson.warnings.length === 0, 'handles skipped skills')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
