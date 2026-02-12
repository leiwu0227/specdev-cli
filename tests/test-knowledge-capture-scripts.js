import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'knowledge-capture-project', 'scripts')
const TEST_DIR = join(__dirname, 'test-knowledge-capture-output')

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
const assignmentDir = join(TEST_DIR, '00001_feature_knowledge-test')
mkdirSync(join(assignmentDir, 'context'), { recursive: true })
mkdirSync(join(assignmentDir, 'tasks'), { recursive: true })

writeFileSync(join(assignmentDir, 'proposal.md'), '# Feature Proposal\n\nBuild a knowledge capture system.')
writeFileSync(join(assignmentDir, 'plan.md'), `# Knowledge System Plan

**Goal:** Build knowledge capture

**Architecture:** File-based knowledge vault with categories

---

### Task 1: Create scanner

**Files:**
- Create: \`src/scanner.js\`

### Task 2: Add domain rules

**Files:**
- Create: \`src/rules.js\`
`)
writeFileSync(join(assignmentDir, 'context', 'decisions.md'), '# Decisions\n\n- Use file-based storage.\n- Categories: codestyle, architecture, domain, workflow.')

// Create a progress file
writeFileSync(join(assignmentDir, 'plan.md.progress.json'), JSON.stringify({
  plan_file: 'plan.md',
  total_tasks: 2,
  tasks: [
    { number: 1, status: 'completed', started_at: '2025-01-01T00:00:00', completed_at: '2025-01-01T01:00:00' },
    { number: 2, status: 'completed', started_at: '2025-01-01T01:00:00', completed_at: '2025-01-01T02:00:00' }
  ]
}))

// Create review_request.json
writeFileSync(join(assignmentDir, 'review_request.json'), JSON.stringify({
  version: '1', assignment_id: '00001_feature_knowledge-test',
  gate: 'gate_4', status: 'passed', requested_at: '2025-01-01T03:00:00'
}))

// ---- Test scan-assignment.sh ----
console.log('\nscan-assignment.sh:')

const script = join(SCRIPTS_DIR, 'scan-assignment.sh')
const result = spawnSync('bash', [script, assignmentDir], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('00001_feature_knowledge-test'), 'includes assignment name')
assert(result.stdout.includes('Goal'), 'includes Goal section')
assert(result.stdout.includes('Approach'), 'includes Approach section')
assert(result.stdout.includes('Decisions') || result.stdout.includes('decisions'), 'includes Decisions section')
assert(result.stdout.includes('Tasks Completed') || result.stdout.includes('Task'), 'includes tasks section')
assert(result.stdout.includes('Review') || result.stdout.includes('gate_4'), 'includes review findings')
assert(result.stdout.includes('Knowledge Categories') || result.stdout.includes('workflow'), 'includes suggested categories')

// Test with missing directory
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
