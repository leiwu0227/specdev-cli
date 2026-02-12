import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'executing', 'scripts')
const TEST_DIR = join(__dirname, 'test-executing-output')

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
mkdirSync(join(TEST_DIR, 'docs', 'plans'), { recursive: true })

// Create a sample plan with 2 tasks
const planFile = join(TEST_DIR, 'docs', 'plans', 'test-plan.md')
writeFileSync(planFile, `# Test Feature Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** Build a test feature

**Architecture:** Simple module with tests

**Tech Stack:** Node.js

---

### Task 1: Create the module

**Files:**
- Create: \`src/mod.js\`
- Test: \`tests/mod.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
import { mod } from '../src/mod.js'
test('mod returns hello', () => { expect(mod()).toBe('hello') })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL with "mod is not defined"

**Step 3: Write minimal implementation**

\`\`\`javascript
export function mod() { return 'hello' }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/mod.js tests/mod.test.js
git commit -m "feat: add mod module"
\`\`\`

### Task 2: Add greeting function

**Files:**
- Modify: \`src/mod.js\`
- Test: \`tests/mod.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
test('greet returns hello name', () => { expect(greet('world')).toBe('hello world') })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL

**Step 3: Write minimal implementation**

\`\`\`javascript
export function greet(name) { return 'hello ' + name }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/mod.js tests/mod.test.js
git commit -m "feat: add greet function"
\`\`\`
`)

// ---- Test extract-tasks.sh ----
console.log('\nextract-tasks.sh:')

const extractScript = join(SCRIPTS_DIR, 'extract-tasks.sh')
const result = spawnSync('bash', [extractScript, planFile], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')

let tasks
try {
  tasks = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 100))
  tasks = []
}

assert(Array.isArray(tasks), 'output is an array')
assert(tasks.length === 2, 'finds 2 tasks')

if (tasks.length >= 1) {
  assert(tasks[0].number === 1, 'task 1 has number 1')
  assert(tasks[0].name.includes('Create the module'), 'task 1 has correct name')
  assert(tasks[0].files && tasks[0].files.length >= 1, 'task 1 has files listed')
}

if (tasks.length >= 2) {
  assert(tasks[1].number === 2, 'task 2 has number 2')
  assert(tasks[1].name.includes('greeting'), 'task 2 has correct name')
}

// Test with missing file
const badResult = spawnSync('bash', [extractScript, '/nonexistent/plan.md'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing file')

// ---- Test track-progress.sh ----
console.log('\ntrack-progress.sh:')

const trackScript = join(SCRIPTS_DIR, 'track-progress.sh')

// Mark task 1 as started
const startResult = spawnSync('bash', [trackScript, planFile, '1', 'started'], { encoding: 'utf-8' })
assert(startResult.status === 0, 'mark task 1 started exits 0')

// Check progress file exists
const progressFile = planFile + '.progress.json'
assert(existsSync(progressFile), 'creates progress file next to plan')

const progress1 = JSON.parse(readFileSync(progressFile, 'utf-8'))
assert(progress1.tasks[0].status === 'in_progress', 'task 1 is in_progress')
assert(progress1.tasks[0].number === 1, 'task 1 number is 1')

// Mark task 1 as completed
const completeResult = spawnSync('bash', [trackScript, planFile, '1', 'completed'], { encoding: 'utf-8' })
assert(completeResult.status === 0, 'mark task 1 completed exits 0')

const progress2 = JSON.parse(readFileSync(progressFile, 'utf-8'))
assert(progress2.tasks[0].status === 'completed', 'task 1 is completed')
assert(progress2.tasks[0].completed_at !== undefined && progress2.tasks[0].completed_at !== null, 'task 1 has completed_at timestamp')

// Mark task 2 as started then completed
spawnSync('bash', [trackScript, planFile, '2', 'started'], { encoding: 'utf-8' })
spawnSync('bash', [trackScript, planFile, '2', 'completed'], { encoding: 'utf-8' })

// Get summary
const summaryResult = spawnSync('bash', [trackScript, planFile, 'summary', ''], { encoding: 'utf-8' })
assert(summaryResult.status === 0, 'summary exits 0')
assert(summaryResult.stdout.includes('2') && summaryResult.stdout.includes('completed'), 'summary shows completed count')

// Test with bad args
const badTrack = spawnSync('bash', [trackScript], { encoding: 'utf-8' })
assert(badTrack.status !== 0, 'exits non-zero with no args')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
