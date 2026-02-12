import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'spec-review', 'scripts')
const TEST_DIR = join(__dirname, 'test-spec-review-output')

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
const assignmentDir = join(TEST_DIR, '00001_feature_test-feature')
mkdirSync(join(assignmentDir, 'context', 'messages'), { recursive: true })
mkdirSync(join(assignmentDir, 'tasks', '01_setup'), { recursive: true })

writeFileSync(join(assignmentDir, 'proposal.md'), '# Feature Proposal\n\nBuild a great feature for testing.')
writeFileSync(join(assignmentDir, 'plan.md'), `# Test Plan

**Goal:** Build test feature

**Architecture:** Simple module

---

### Task 1: Setup

**Files:**
- Create: \`src/feature.js\`
`)
writeFileSync(join(assignmentDir, 'context', 'decisions.md'), '# Decisions\n\n- Chose approach A over B for simplicity.')
writeFileSync(join(assignmentDir, 'tasks', '01_setup', 'spec.md'), '# Task 1 Spec\nCreate the feature module.')
writeFileSync(join(assignmentDir, 'tasks', '01_setup', 'result.md'), '# Task 1 Result\nCompleted.')

// ---- Test get-assignment-context.sh ----
console.log('\nget-assignment-context.sh:')

const script = join(SCRIPTS_DIR, 'get-assignment-context.sh')
const result = spawnSync('bash', [script, assignmentDir], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('00001_feature_test-feature'), 'includes assignment name')
assert(result.stdout.includes('Feature Proposal') || result.stdout.includes('Proposal'), 'includes proposal content')
assert(result.stdout.includes('Test Plan') || result.stdout.includes('Plan'), 'includes plan content')
assert(result.stdout.includes('Decisions'), 'includes decisions section')
assert(result.stdout.includes('Tasks') || result.stdout.includes('01_setup'), 'includes tasks section')

// Test with review_request.json present
writeFileSync(join(assignmentDir, 'review_request.json'), JSON.stringify({
  version: '1', assignment_id: '00001_feature_test-feature',
  gate: 'gate_3', status: 'pending'
}))
const withReview = spawnSync('bash', [script, assignmentDir], { encoding: 'utf-8' })
assert(withReview.stdout.includes('Review Status') || withReview.stdout.includes('gate_3'), 'includes review status when present')

// Test with missing directory
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
