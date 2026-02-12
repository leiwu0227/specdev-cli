import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'verification', 'scripts')
const TEST_DIR = join(__dirname, 'test-verification-output')

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

// Setup: create a mock assignment + project
cleanup()
const assignmentDir = join(TEST_DIR, 'assignment', '00001_feature_test')
mkdirSync(join(assignmentDir, 'context'), { recursive: true })
mkdirSync(join(assignmentDir, 'tasks'), { recursive: true })
mkdirSync(join(assignmentDir, 'scaffold'), { recursive: true })

// Create proposal and plan
writeFileSync(join(assignmentDir, 'proposal.md'), '# Proposal\nBuild a test feature.')
writeFileSync(join(assignmentDir, 'plan.md'), `# Test Plan

### Task 1: Do something

**Files:**
- Create: \`src/thing.js\`

### Task 2: Do another

**Files:**
- Create: \`src/other.js\`
`)

// Create a mock project root
const projectDir = join(TEST_DIR, 'project')
mkdirSync(join(projectDir, 'src'), { recursive: true })
writeFileSync(join(projectDir, 'package.json'), '{"name": "test", "scripts": {"test": "echo ok"}}')

// ---- Test verify-gates.sh ----
console.log('\nverify-gates.sh:')

const script = join(SCRIPTS_DIR, 'verify-gates.sh')

// Test with assignment that has proposal + plan but no review
const result = spawnSync('bash', [script, assignmentDir, projectDir], { encoding: 'utf-8' })

// Should exit 1 because review gates are not passed
assert(result.status === 1, 'exits 1 when gates fail')

let output
try {
  output = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 200))
  output = { gates: {} }
}

assert(output.assignment === '00001_feature_test', 'includes assignment name')
assert(output.gates.gate_0 && output.gates.gate_0.passed === true, 'gate_0 passes (proposal + plan exist)')
assert(output.gates.gate_0.checks && output.gates.gate_0.checks.length >= 2, 'gate_0 has checks for proposal and plan')
assert(output.gates.gate_3 && output.gates.gate_3.passed === false, 'gate_3 fails (no review)')
assert(output.all_passed === false, 'all_passed is false')

// Test with missing proposal
const noProposalDir = join(TEST_DIR, 'assignment', '00002_no_proposal')
mkdirSync(noProposalDir, { recursive: true })
writeFileSync(join(noProposalDir, 'plan.md'), '# Plan\n### Task 1: Test')

const noProposalResult = spawnSync('bash', [script, noProposalDir, projectDir], { encoding: 'utf-8' })
assert(noProposalResult.status === 1, 'exits 1 when proposal missing')

let noProposalOutput
try {
  noProposalOutput = JSON.parse(noProposalResult.stdout)
  assert(noProposalOutput.gates.gate_0.passed === false, 'gate_0 fails when proposal missing')
} catch (e) {
  assert(false, 'missing proposal outputs valid JSON')
}

// Test with bad args
const badResult = spawnSync('bash', [script, '/nonexistent', projectDir], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing assignment directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
