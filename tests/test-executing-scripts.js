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

// ---- Additional test sections will be appended here (task 3) ----

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
