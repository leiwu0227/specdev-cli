import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'planning', 'scripts')
const TEST_DIR = join(__dirname, 'test-planning-output')

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

// Setup: create a fake project
cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'project'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'workflow'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'state', 'assignments'), { recursive: true })
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), '{"name": "test-project", "version": "1.0.0"}')
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')
writeFileSync(join(TEST_DIR, '.specdev', 'knowledge', 'project', 'architecture.md'), '# Architecture\nUses MVC pattern.')

// Init git repo for commit history
spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test get-project-context.sh ----
console.log('\nget-project-context.sh:')

const script = join(SCRIPTS_DIR, 'get-project-context.sh')
const result = spawnSync('bash', [script, TEST_DIR], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('test-project'), 'includes project name from package.json')
assert(result.stdout.includes('src/index.js') || result.stdout.includes('src/'), 'includes file structure')
assert(result.stdout.includes('Architecture') || result.stdout.includes('MVC'), 'includes knowledge content')
assert(result.stdout.includes('init'), 'includes recent commit history')

// Test with missing project root
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

// ---- Test scaffold-plan.sh ----
console.log('\nscaffold-plan.sh:')

const scaffoldScript = join(SCRIPTS_DIR, 'scaffold-plan.sh')

// Create docs/plans directory
mkdirSync(join(TEST_DIR, 'docs', 'plans'), { recursive: true })

const scaffoldResult = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })

assert(scaffoldResult.status === 0, 'exits with code 0')

// Check the file was created with today's date
const today = new Date().toISOString().split('T')[0]
const expectedFile = join(TEST_DIR, 'docs', 'plans', `${today}-my-feature.md`)
assert(existsSync(expectedFile), 'creates plan file with date prefix')

const planContent = readFileSync(expectedFile, 'utf-8')
assert(planContent.includes('Implementation Plan'), 'includes plan header')
assert(planContent.includes('specdev:executing'), 'includes execution instruction')
assert(planContent.includes('**Goal:**'), 'includes goal placeholder')
assert(planContent.includes('### Task 1:'), 'includes task template')
assert(planContent.includes('**Step 1: Write the failing test**'), 'includes TDD step template')

// Outputs the file path
assert(scaffoldResult.stdout.includes(expectedFile) || scaffoldResult.stdout.includes(`${today}-my-feature.md`), 'outputs created file path')

// Fails if plan already exists (no overwrite)
const scaffoldAgain = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })
assert(scaffoldAgain.status !== 0, 'refuses to overwrite existing plan')

// ---- Test validate-plan.sh ----
console.log('\nvalidate-plan.sh:')

const validateScript = join(SCRIPTS_DIR, 'validate-plan.sh')

// Create a valid plan
const validPlan = join(TEST_DIR, 'docs', 'plans', 'valid-plan.md')
writeFileSync(validPlan, `# Test Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** Test the validator

**Architecture:** Simple test

**Tech Stack:** Node.js

---

### Task 1: Add feature

**Files:**
- Create: \`src/feature.js\`
- Test: \`tests/feature.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
test('feature works', () => { expect(true).toBe(true) })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL

**Step 3: Write minimal implementation**

\`\`\`javascript
function feature() { return true }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/feature.js tests/feature.test.js
git commit -m "feat: add feature"
\`\`\`
`)

const validResult = spawnSync('bash', [validateScript, validPlan], { encoding: 'utf-8' })
assert(validResult.status === 0, 'valid plan passes validation')
assert(validResult.stdout.includes('1 task') || validResult.stdout.includes('1 found'), 'reports task count')

// Create an incomplete plan (missing code blocks)
const incompletePlan = join(TEST_DIR, 'docs', 'plans', 'incomplete-plan.md')
writeFileSync(incompletePlan, `# Incomplete Plan

> **For agent:** Use specdev:executing skill.

**Goal:** Test

---

### Task 1: Do something

**Files:**
- Create: \`src/thing.js\`

**Step 1: Write the failing test**

Add some test code here.

**Step 3: Write minimal implementation**

Add implementation.
`)

const incompleteResult = spawnSync('bash', [validateScript, incompletePlan], { encoding: 'utf-8' })
assert(incompleteResult.status !== 0, 'incomplete plan fails validation')
assert(incompleteResult.stderr.includes('FAIL') || incompleteResult.stdout.includes('FAIL') || incompleteResult.stderr.includes('missing'), 'reports what is missing')

// Missing file
const missingResult = spawnSync('bash', [validateScript, '/nonexistent/plan.md'], { encoding: 'utf-8' })
assert(missingResult.status !== 0, 'exits non-zero for missing file')

// ---- Test register-assignment.sh ----
console.log('\nregister-assignment.sh:')

const registerScript = join(SCRIPTS_DIR, 'register-assignment.sh')

// Create state directory
mkdirSync(join(TEST_DIR, '.specdev', 'state', 'assignments'), { recursive: true })

// Register using the valid plan (validPlan was created in the validate-plan tests above)
const registerResult = spawnSync('bash', [registerScript, validPlan, TEST_DIR, 'feature', 'test-feature'], { encoding: 'utf-8' })

assert(registerResult.status === 0, 'exits with code 0')

// Check assignment directory was created
const stateDir = join(TEST_DIR, '.specdev', 'state', 'assignments')
const entries = readdirSync(stateDir).filter(e => e !== '.gitkeep')
assert(entries.length === 1, 'creates one assignment entry')
assert(entries[0].includes('feature') && entries[0].includes('test-feature'), 'assignment name includes type and label')

const assignmentDir = join(stateDir, entries[0])

// Check proposal.md created
assert(existsSync(join(assignmentDir, 'proposal.md')), 'creates proposal.md')

// Check plan.md is linked/copied
assert(existsSync(join(assignmentDir, 'plan.md')), 'creates plan.md')
const planLink = readFileSync(join(assignmentDir, 'plan.md'), 'utf-8')
assert(planLink.includes('valid-plan.md') || planLink.includes('Test Plan'), 'plan.md references or contains the plan')

// Check context directory
assert(existsSync(join(assignmentDir, 'context')), 'creates context/ directory')

// Check tasks directory
assert(existsSync(join(assignmentDir, 'tasks')), 'creates tasks/ directory')

// Outputs assignment path
assert(registerResult.stdout.includes(entries[0]), 'outputs assignment directory name')

// Second registration gets next ID
const registerResult2 = spawnSync('bash', [registerScript, validPlan, TEST_DIR, 'bugfix', 'fix-thing'], { encoding: 'utf-8' })
assert(registerResult2.status === 0, 'second registration succeeds')
const entries2 = readdirSync(stateDir).filter(e => e !== '.gitkeep')
assert(entries2.length === 2, 'creates second assignment')

// IDs should be sequential
const ids = entries2.map(e => parseInt(e.split('_')[0])).sort((a,b) => a-b)
assert(ids[1] === ids[0] + 1, 'assignment IDs are sequential')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
