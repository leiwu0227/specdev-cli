# Workflow V4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify specdev CLI to single-thread auto-review with inline user approval, adopting superpowers patterns for implementation phase.

**Architecture:** Replace 2-agent review commands (`main request-review`, `review start/accept/reject`) with phase-entry commands (`start`, `assignment`, `breakdown`, `implement`) and a single `review` command for optional manual review. Add SessionStart hook for Claude Code. Remove `remind` (replaced by hook).

**Tech Stack:** Node.js (ES modules), fs-extra, bash (hooks)

---

### Task 1: Remove old commands and scaffold new ones

Remove the old multi-subcommand `main.js` and `remind.js`. Create stub files for new commands. Update the router to route to new commands.

**Files:**
- Delete: `src/commands/main.js`
- Delete: `src/commands/remind.js`
- Create: `src/commands/start.js`
- Create: `src/commands/assignment.js`
- Create: `src/commands/breakdown.js`
- Create: `src/commands/implement.js`
- Modify: `src/commands/review.js` (complete rewrite)
- Modify: `bin/specdev.js`
- Modify: `package.json`

**Step 1: Delete old command files**

```bash
rm src/commands/main.js src/commands/remind.js
```

**Step 2: Create stub command files**

Each stub exports an async function that prints "not yet implemented" and exits 1. This lets the router work while we implement each command in later tasks.

`src/commands/start.js`:
```js
export async function startCommand(flags = {}) {
  console.error('❌ specdev start: not yet implemented')
  process.exit(1)
}
```

`src/commands/assignment.js`:
```js
export async function assignmentCommand(args = [], flags = {}) {
  console.error('❌ specdev assignment: not yet implemented')
  process.exit(1)
}
```

`src/commands/breakdown.js`:
```js
export async function breakdownCommand(flags = {}) {
  console.error('❌ specdev breakdown: not yet implemented')
  process.exit(1)
}
```

`src/commands/implement.js`:
```js
export async function implementCommand(flags = {}) {
  console.error('❌ specdev implement: not yet implemented')
  process.exit(1)
}
```

`src/commands/review.js` (complete rewrite — single command, no subcommands):
```js
export async function reviewCommand(flags = {}) {
  console.error('❌ specdev review: not yet implemented')
  process.exit(1)
}
```

**Step 3: Update the router**

Rewrite `bin/specdev.js` to import new commands and route to them:

```js
#!/usr/bin/env node

import { initCommand } from '../src/commands/init.js'
import { updateCommand } from '../src/commands/update.js'
import { helpCommand } from '../src/commands/help.js'
import { ponderWorkflowCommand } from '../src/commands/ponder-workflow.js'
import { ponderProjectCommand } from '../src/commands/ponder-project.js'
import { skillsCommand } from '../src/commands/skills.js'
import { startCommand } from '../src/commands/start.js'
import { assignmentCommand } from '../src/commands/assignment.js'
import { breakdownCommand } from '../src/commands/breakdown.js'
import { implementCommand } from '../src/commands/implement.js'
import { reviewCommand } from '../src/commands/review.js'

const [,, command, ...args] = process.argv

// Parse flags
const flags = {}
const positionalArgs = []

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const equalIndex = arg.indexOf('=')
    if (equalIndex > -1) {
      const key = arg.slice(2, equalIndex)
      const value = arg.slice(equalIndex + 1)
      flags[key] = value
    } else {
      flags[arg.slice(2)] = true
    }
  } else if (arg.startsWith('-')) {
    flags[arg.slice(1)] = true
  } else {
    positionalArgs.push(arg)
  }
})

switch(command) {
  case 'init':
    await initCommand(flags)
    break
  case 'update':
    await updateCommand(flags)
    break
  case 'skills':
    await skillsCommand(flags)
    break
  case 'start':
    await startCommand(flags)
    break
  case 'assignment':
    await assignmentCommand(positionalArgs, flags)
    break
  case 'breakdown':
    await breakdownCommand(flags)
    break
  case 'implement':
    await implementCommand(flags)
    break
  case 'review':
    await reviewCommand(flags)
    break
  case 'ponder': {
    const subcommand = positionalArgs[0]
    if (subcommand === 'workflow') {
      await ponderWorkflowCommand(flags)
    } else if (subcommand === 'project') {
      await ponderProjectCommand(flags)
    } else {
      console.error(`Unknown ponder subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev ponder <workflow|project>')
      process.exit(1)
    }
    break
  }
  case 'help':
  case '--help':
  case '-h':
    helpCommand()
    break
  case '--version':
  case '-v':
    const pkg = await import('../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    break
  default:
    if (!command) {
      helpCommand()
    } else {
      console.error(`Unknown command: ${command}`)
      console.log('Run "specdev help" for usage information')
      process.exit(1)
    }
}
```

**Step 4: Update package.json test scripts**

Remove `test:main`, `test:check` (which was already renamed to `test:review`), and `test:remind`. Add new test scripts. Update the `test` runner and `test:cleanup`.

In `package.json` scripts:
- Remove: `"test:main"`, `"test:review"`, `"test:remind"`
- Add: `"test:start"`, `"test:assignment"`, `"test:breakdown"`, `"test:implement"`, `"test:review-cmd"`
- Update `"test"` to reference the new scripts
- Update `"test:cleanup"` to include new test output dirs

**Step 5: Delete old test files**

```bash
rm tests/test-main.js tests/test-review.js tests/test-remind.js
```

**Step 6: Verify the scaffold builds**

Run: `node ./bin/specdev.js help`
Expected: exits 0, shows help text (help.js is not yet updated, so it will show old text — that's fine)

Run: `node ./bin/specdev.js start`
Expected: exits 1, shows "not yet implemented"

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove old commands, scaffold new V4 command structure"
```

---

### Task 2: Implement `specdev start`

`specdev start` checks for `.specdev/`, reads `big_picture.md`, and prints its status.

**Files:**
- Create: `tests/test-start.js`
- Modify: `src/commands/start.js`

**Step 1: Write the failing test**

`tests/test-start.js`:
```js
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-start-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Test 1: fails without .specdev
  console.log('start without .specdev:')
  mkdirSync(TEST_DIR, { recursive: true })
  const noSpecdev = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(noSpecdev.status === 1, 'exits non-zero without .specdev')) failures++
  if (!assert(noSpecdev.stderr.includes('No .specdev') || noSpecdev.stdout.includes('No .specdev'),
    'mentions missing .specdev')) failures++

  // Test 2: detects empty/template big_picture.md
  console.log('\nstart with template big_picture:')
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  const startTemplate = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(startTemplate.status === 0, 'exits 0 with template big_picture')) failures++
  if (!assert(startTemplate.stdout.includes('needs') || startTemplate.stdout.includes('Fill in'),
    'tells user to fill in big_picture')) failures++

  // Test 3: shows content when big_picture.md is filled
  console.log('\nstart with filled big_picture:')
  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project Big Picture\n\n## Overview\nThis is a real project with real content that has been filled in properly.\n\n## Tech Stack\nNode.js, TypeScript\n')
  const startFilled = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(startFilled.status === 0, 'exits 0 with filled big_picture')) failures++
  if (!assert(startFilled.stdout.includes('real project'), 'shows big_picture content')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} start test(s) failed`); process.exit(1) }
  console.log('✅ All start tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node ./tests/test-start.js`
Expected: FAIL (start command prints "not yet implemented")

**Step 3: Write minimal implementation**

`src/commands/start.js`:
```js
import { join } from 'path'
import fse from 'fs-extra'

export async function startCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')

  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    const isFilled = content.trim().length > 100 && !content.includes('TODO: filled by')

    if (isFilled) {
      console.log('📋 Current project context:')
      console.log('')
      console.log(content)
    } else {
      console.log('📝 big_picture.md needs to be filled in')
      console.log(`   Path: ${bigPicturePath}`)
    }
  } else {
    console.log('📝 big_picture.md not found')
  }

  console.log('')
  console.log('Fill in big_picture.md with your project context:')
  console.log('  - What does this project do?')
  console.log('  - Who are the users?')
  console.log('  - Tech stack and key dependencies')
  console.log('  - Architecture decisions and patterns')
  console.log('  - Conventions and constraints')
}
```

**Step 4: Run test to verify it passes**

Run: `node ./tests/test-start.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/start.js tests/test-start.js
git commit -m "feat: implement specdev start command"
```

---

### Task 3: Implement `specdev assignment`

`specdev assignment [name]` creates a new assignment directory with a sequential ID and prints instructions to follow the brainstorming skill.

**Files:**
- Create: `tests/test-assignment.js`
- Modify: `src/commands/assignment.js`

**Step 1: Write the failing test**

`tests/test-assignment.js`:
```js
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-assignment-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Setup
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  // Fill in big_picture.md (prerequisite)
  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the check.\n\n## Tech Stack\nNode.js\n')

  // Test 1: creates assignment directory
  console.log('assignment creates directory:')
  const result = runCmd(['./bin/specdev.js', 'assignment', 'auth-system', `--target=${TEST_DIR}`])
  if (!assert(result.status === 0, 'exits 0', result.stderr)) failures++

  const assignmentsDir = join(TEST_DIR, '.specdev/assignments')
  const entries = existsSync(assignmentsDir) ? readdirSync(assignmentsDir) : []
  const created = entries.find(e => e.includes('auth-system'))
  if (!assert(created, 'creates assignment directory with name')) failures++
  if (!assert(created && created.match(/^\d{5}_/), 'directory has sequential ID prefix')) failures++

  // Test 2: prints brainstorming instructions
  if (!assert(result.stdout.includes('brainstorming') || result.stdout.includes('SKILL.md'),
    'mentions brainstorming skill')) failures++

  // Test 3: creates brainstorm subdirectory
  if (created) {
    const brainstormDir = join(assignmentsDir, created, 'brainstorm')
    if (!assert(existsSync(brainstormDir), 'creates brainstorm/ subdirectory')) failures++
  }

  // Test 4: second assignment gets next ID
  console.log('\nassignment increments ID:')
  const result2 = runCmd(['./bin/specdev.js', 'assignment', 'payment', `--target=${TEST_DIR}`])
  if (!assert(result2.status === 0, 'second assignment exits 0')) failures++
  const entries2 = readdirSync(assignmentsDir)
  const second = entries2.find(e => e.includes('payment'))
  if (!assert(second && second.startsWith('00002'), 'second assignment gets ID 00002')) failures++

  // Test 5: fails without big_picture.md filled
  console.log('\nassignment without big_picture:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const noBigPicture = runCmd(['./bin/specdev.js', 'assignment', 'test', `--target=${TEST_DIR}`])
  if (!assert(noBigPicture.status === 1, 'exits non-zero without big_picture filled')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} assignment test(s) failed`); process.exit(1) }
  console.log('✅ All assignment tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node ./tests/test-assignment.js`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/commands/assignment.js`:
```js
import { join } from 'path'
import fse from 'fs-extra'

export async function assignmentCommand(args = [], flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  // Check big_picture.md is filled
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    if (content.trim().length < 100 || content.includes('TODO: filled by')) {
      console.error('❌ big_picture.md is not filled in')
      console.log('   Run "specdev start" first to set up your project context')
      process.exit(1)
    }
  } else {
    console.error('❌ big_picture.md not found')
    process.exit(1)
  }

  // Determine next assignment ID
  const assignmentsDir = join(specdevPath, 'assignments')
  await fse.ensureDir(assignmentsDir)

  const existing = await fse.readdir(assignmentsDir)
  const ids = existing
    .map(name => parseInt(name.match(/^(\d+)/)?.[1], 10))
    .filter(n => !isNaN(n))
  const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const paddedId = String(nextId).padStart(5, '0')

  // Build assignment name
  const label = args[0] || 'unnamed'
  const dirName = `${paddedId}_feature_${label}`
  const assignmentPath = join(assignmentsDir, dirName)

  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.ensureDir(join(assignmentPath, 'context'))

  console.log(`✅ Assignment created: ${dirName}`)
  console.log(`   Path: ${assignmentPath}`)
  console.log('')
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  console.log(`   Write outputs to: ${dirName}/brainstorm/`)
}
```

**Step 4: Run test to verify it passes**

Run: `node ./tests/test-assignment.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/assignment.js tests/test-assignment.js
git commit -m "feat: implement specdev assignment command"
```

---

### Task 4: Implement `specdev breakdown`

Validates that brainstorm artifacts exist for the current assignment, then prints instructions to follow the breakdown skill.

**Files:**
- Create: `tests/test-breakdown.js`
- Modify: `src/commands/breakdown.js`

**Step 1: Write the failing test**

`tests/test-breakdown.js`:
```js
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-breakdown-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Setup: init + create assignment with brainstorm artifacts
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })

  // Test 1: fails without brainstorm artifacts
  console.log('breakdown without brainstorm artifacts:')
  const noArtifacts = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noArtifacts.status === 1, 'exits non-zero without design.md')) failures++

  // Test 2: succeeds with design.md
  console.log('\nbreakdown with design.md:')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  const withDesign = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withDesign.status === 0, 'exits 0 with design.md', withDesign.stderr)) failures++
  if (!assert(withDesign.stdout.includes('breakdown') || withDesign.stdout.includes('SKILL.md'),
    'mentions breakdown skill')) failures++

  // Test 3: creates breakdown subdirectory
  if (!assert(existsSync(join(assignment, 'breakdown')), 'creates breakdown/ subdirectory')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} breakdown test(s) failed`); process.exit(1) }
  console.log('✅ All breakdown tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node ./tests/test-breakdown.js`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/commands/breakdown.js`:
```js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'

export async function breakdownCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Check brainstorm artifacts exist
  const designPath = join(assignmentPath, 'brainstorm', 'design.md')
  const proposalPath = join(assignmentPath, 'brainstorm', 'proposal.md')

  if (!(await fse.pathExists(designPath))) {
    console.error('❌ No brainstorm/design.md found')
    console.log('   Complete the brainstorm phase first with: specdev assignment')
    process.exit(1)
  }

  // Ensure breakdown directory exists
  await fse.ensureDir(join(assignmentPath, 'breakdown'))

  console.log(`📋 Breakdown: ${name}`)
  console.log('')
  console.log('Read .specdev/skills/core/breakdown/SKILL.md and follow it.')
  console.log(`   Input: ${name}/brainstorm/design.md`)
  console.log(`   Output: ${name}/breakdown/plan.md`)
}
```

**Step 4: Run test to verify it passes**

Run: `node ./tests/test-breakdown.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/breakdown.js tests/test-breakdown.js
git commit -m "feat: implement specdev breakdown command"
```

---

### Task 5: Implement `specdev implement`

Validates that `breakdown/plan.md` exists, then prints instructions to follow the implementing skill.

**Files:**
- Create: `tests/test-implement.js`
- Modify: `src/commands/implement.js`

**Step 1: Write the failing test**

`tests/test-implement.js`:
```js
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-implement-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })

  // Test 1: fails without plan.md
  console.log('implement without plan.md:')
  const noPlan = runCmd([
    './bin/specdev.js', 'implement',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noPlan.status === 1, 'exits non-zero without plan.md')) failures++

  // Test 2: succeeds with plan.md
  console.log('\nimplement with plan.md:')
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n\n## Task 1\nDo something.\n')
  const withPlan = runCmd([
    './bin/specdev.js', 'implement',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withPlan.status === 0, 'exits 0 with plan.md', withPlan.stderr)) failures++
  if (!assert(withPlan.stdout.includes('implement') || withPlan.stdout.includes('SKILL.md'),
    'mentions implementing skill')) failures++

  // Test 3: creates implementation subdirectory
  if (!assert(existsSync(join(assignment, 'implementation')), 'creates implementation/ subdirectory')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} implement test(s) failed`); process.exit(1) }
  console.log('✅ All implement tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node ./tests/test-implement.js`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/commands/implement.js`:
```js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'

export async function implementCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Check plan exists
  const planPath = join(assignmentPath, 'breakdown', 'plan.md')

  if (!(await fse.pathExists(planPath))) {
    console.error('❌ No breakdown/plan.md found')
    console.log('   Complete the breakdown phase first with: specdev breakdown')
    process.exit(1)
  }

  // Ensure implementation directory exists
  await fse.ensureDir(join(assignmentPath, 'implementation'))

  console.log(`🔨 Implement: ${name}`)
  console.log('')
  console.log('Read .specdev/skills/core/implementing/SKILL.md and follow it.')
  console.log(`   Input: ${name}/breakdown/plan.md`)
  console.log(`   Output: committed code per task`)
  console.log('')
  console.log('Per-task flow:')
  console.log('  1. Dispatch implementer subagent (TDD: red → green → refactor)')
  console.log('  2. Spec review subagent (loop until PASS, max 10 rounds)')
  console.log('  3. Code quality review subagent (CRITICAL → fix, MINOR → note)')
  console.log('  4. Commit and mark task complete')
}
```

**Step 4: Run test to verify it passes**

Run: `node ./tests/test-implement.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/implement.js tests/test-implement.js
git commit -m "feat: implement specdev implement command"
```

---

### Task 6: Rewrite `specdev review`

Single command (no subcommands). Detects current phase from assignment artifacts and prints phase-appropriate review context for a manual reviewer in a separate session.

**Files:**
- Create: `tests/test-review-cmd.js`
- Modify: `src/commands/review.js`

**Step 1: Write the failing test**

`tests/test-review-cmd.js`:
```js
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-review-cmd-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])

  // Test 1: review after brainstorm phase
  console.log('review after brainstorm:')
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')

  const brainstormReview = runCmd([
    './bin/specdev.js', 'review',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(brainstormReview.status === 0, 'exits 0', brainstormReview.stderr)) failures++
  if (!assert(brainstormReview.stdout.includes('brainstorm') || brainstormReview.stdout.includes('design'),
    'mentions brainstorm phase context')) failures++

  // Test 2: review after implementation phase
  console.log('\nreview after implementation:')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  mkdirSync(join(assignment, 'implementation'), { recursive: true })
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}')

  const implReview = runCmd([
    './bin/specdev.js', 'review',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(implReview.status === 0, 'exits 0 for implementation review')) failures++
  if (!assert(implReview.stdout.includes('implementation') || implReview.stdout.includes('code'),
    'mentions implementation/code review context')) failures++

  // Test 3: review without any assignment
  console.log('\nreview without assignment:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const noAssignment = runCmd(['./bin/specdev.js', 'review', `--target=${TEST_DIR}`])
  if (!assert(noAssignment.status === 1, 'exits non-zero without assignment')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} review test(s) failed`); process.exit(1) }
  console.log('✅ All review tests passed')
}

runTests()
```

**Step 2: Run test to verify it fails**

Run: `node ./tests/test-review-cmd.js`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/commands/review.js`:
```js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'

/**
 * specdev review — Phase-aware manual review (separate session)
 *
 * Detects current phase from assignment artifacts and prints
 * appropriate review context for the reviewer.
 */
export async function reviewCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Detect phase from artifacts (latest phase wins)
  const hasImplementation = await fse.pathExists(join(assignmentPath, 'implementation'))
  const hasPlan = await fse.pathExists(join(assignmentPath, 'breakdown', 'plan.md'))
  const hasDesign = await fse.pathExists(join(assignmentPath, 'brainstorm', 'design.md'))
  const hasProposal = await fse.pathExists(join(assignmentPath, 'brainstorm', 'proposal.md'))

  let phase
  if (hasImplementation) {
    phase = 'implementation'
  } else if (hasPlan) {
    phase = 'breakdown'
  } else if (hasDesign || hasProposal) {
    phase = 'brainstorm'
  } else {
    console.error('❌ No reviewable artifacts found')
    console.log('   Complete at least the brainstorm phase first')
    process.exit(1)
  }

  console.log(`🔍 Manual Review: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log('')

  if (phase === 'brainstorm') {
    console.log('Review scope: Design completeness and feasibility')
    console.log('')
    console.log('Artifacts to review:')
    if (hasProposal) console.log(`   - ${name}/brainstorm/proposal.md`)
    if (hasDesign) console.log(`   - ${name}/brainstorm/design.md`)
    console.log('')
    console.log('Check:')
    console.log('  1. Is the design complete? Any missing sections?')
    console.log('  2. Is it feasible with the current tech stack?')
    console.log('  3. Are edge cases and error handling addressed?')
    console.log('  4. Is the scope appropriate (not too large)?')
  } else if (phase === 'breakdown') {
    console.log('Review scope: Plan completeness')
    console.log('')
    console.log('Artifacts to review:')
    console.log(`   - ${name}/breakdown/plan.md`)
    if (hasDesign) console.log(`   - ${name}/brainstorm/design.md (for reference)`)
    console.log('')
    console.log('Check:')
    console.log('  1. Does the plan cover all design requirements?')
    console.log('  2. Are tasks properly ordered by dependency?')
    console.log('  3. Does each task have exact file paths, code, and commands?')
    console.log('  4. Are tasks small enough (2-5 minutes each)?')
  } else if (phase === 'implementation') {
    console.log('Review scope: Spec compliance + code quality')
    console.log('')
    console.log('Artifacts to review:')
    console.log(`   - ${name}/brainstorm/design.md (what was requested)`)
    console.log(`   - ${name}/breakdown/plan.md (what was planned)`)
    console.log(`   - Changed code files (what was built)`)
    console.log('')
    console.log('Check:')
    console.log('  1. Spec compliance: does implementation match the design?')
    console.log('  2. Code quality: architecture, testing, style')
    console.log('  3. Tag findings as CRITICAL or MINOR')
    console.log('  4. Discuss findings with user before concluding')
  }

  console.log('')
  console.log('After review, return to the main session to approve or provide feedback.')
}
```

**Step 4: Run test to verify it passes**

Run: `node ./tests/test-review-cmd.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/review.js tests/test-review-cmd.js
git commit -m "feat: rewrite specdev review as single phase-aware command"
```

---

### Task 7: Update help text

Update `src/commands/help.js` to reflect the new V4 command structure.

**Files:**
- Modify: `src/commands/help.js`

**Step 1: Write the failing test**

Add to an existing test or check inline. The simplest check: read `help.js` and verify it contains the new command names.

Run: `node -e "import('./src/commands/help.js').then(m => { const s = m.helpCommand.toString(); const ok = s.includes('specdev start') && s.includes('specdev assignment') && s.includes('specdev breakdown') && s.includes('specdev implement') && !s.includes('main <sub>'); console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1) })"`
Expected: FAIL

**Step 2: Run test to verify it fails**

Run the command above.
Expected: FAIL (help still shows old commands)

**Step 3: Write minimal implementation**

`src/commands/help.js`:
```js
export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Spec-Driven Workflow for Coding Agents

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
  skills              List available .specdev skills in this project
  start               Check/fill project context (big_picture.md)
  assignment [name]   Create assignment and start brainstorm phase
  breakdown           Validate brainstorm, start breakdown phase
  implement           Validate plan, start implementation phase
  review              Phase-aware manual review (separate session)
  ponder workflow     Interactive: review & write workflow feedback
  ponder project      Interactive: review & write local project knowledge
  help                Show this help message
  --version, -v       Show version number

OPTIONS:
  --force, -f       Overwrite existing .specdev folder
  --dry-run         Show what would be copied without copying
  --target=<path>   Specify target directory (default: current directory)
  --assignment=<id> Specify assignment (default: latest)

WORKFLOW:
  specdev init --platform=claude
  specdev start                     # Fill in project context
  specdev assignment my-feature     # Create assignment, start brainstorm
  specdev breakdown                 # Decompose design into tasks
  specdev implement                 # Execute tasks with TDD

  # Optional: manual review in separate session
  specdev review

  # Knowledge capture
  specdev ponder workflow
  specdev ponder project

For more information, visit: https://github.com/leiwu0227/specdev-cli
`)
}
```

**Step 4: Run test to verify it passes**

Run: `node -e "import('./src/commands/help.js').then(m => { const s = m.helpCommand.toString(); const ok = s.includes('specdev start') && s.includes('specdev assignment') && s.includes('specdev breakdown') && s.includes('specdev implement') && !s.includes('main <sub>'); console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1) })"`
Expected: PASS

Also verify: `node ./bin/specdev.js help`
Expected: Shows new help text

**Step 5: Commit**

```bash
git add src/commands/help.js
git commit -m "feat: update help text for V4 command structure"
```

---

### Task 8: Create SessionStart hook

Create the hook files that inject phase-aware context on every Claude Code session start/resume/compact. This reuses the logic from the old `remind` command.

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.sh`

**Step 1: Write the failing test**

Test that the hook script runs and outputs valid JSON with `additionalContext`.

Create a temp test inline:
Run: `bash hooks/session-start.sh 2>/dev/null; echo "EXIT: $?"`
Expected: FAIL (file doesn't exist)

**Step 2: Verify fails**

Run: `test -f hooks/session-start.sh && echo EXISTS || echo MISSING`
Expected: MISSING

**Step 3: Write minimal implementation**

`hooks/hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh",
            "async": true
          }
        ]
      }
    ]
  }
}
```

`hooks/session-start.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook for specdev
# Injects phase-aware context into Claude Code sessions

SPECDEV_DIR=".specdev"

# No-op if .specdev doesn't exist
if [ ! -d "$SPECDEV_DIR" ]; then
  echo '{}'
  exit 0
fi

# Find latest assignment
ASSIGNMENTS_DIR="$SPECDEV_DIR/assignments"
if [ ! -d "$ASSIGNMENTS_DIR" ]; then
  # No assignments yet — just inject basic awareness
  CONTEXT="You have specdev installed. Read .specdev/_main.md for the full workflow.\n\nAnnounce every subtask with \"Using specdev: <action>\"."
  ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF
  exit 0
fi

# Find latest (highest numbered) assignment
LATEST=$(ls -1d "$ASSIGNMENTS_DIR"/*/ 2>/dev/null | sort | tail -1)
if [ -z "$LATEST" ]; then
  echo '{}'
  exit 0
fi

ASSIGNMENT_NAME=$(basename "$LATEST")

# Detect phase from artifacts
PHASE="no assignment"
if [ -d "$LATEST/implementation" ]; then
  PHASE="implementation"
elif [ -f "$LATEST/breakdown/plan.md" ]; then
  PHASE="breakdown"
elif [ -f "$LATEST/brainstorm/design.md" ] || [ -f "$LATEST/brainstorm/proposal.md" ]; then
  PHASE="brainstorm"
else
  PHASE="new (no artifacts yet)"
fi

# Build context message
CONTEXT="SpecDev active. Assignment: $ASSIGNMENT_NAME | Phase: $PHASE\n\n"

case "$PHASE" in
  brainstorm)
    CONTEXT="${CONTEXT}Rules:\n- Interactive Q&A to validate the design\n- Produce proposal.md and design.md\n- Do not start coding until design is approved\n\nNext: Complete design, get user approval, then run specdev breakdown"
    ;;
  breakdown)
    CONTEXT="${CONTEXT}Rules:\n- Break design into executable tasks in breakdown/plan.md\n- Each task: 2-5 min, TDD, exact file paths and code\n- Include acceptance criteria for every task\n\nNext: Complete plan.md, auto-review, then run specdev implement"
    ;;
  implementation)
    CONTEXT="${CONTEXT}Rules:\n- TDD: write failing test -> make it pass -> refactor\n- No completion claims without running tests\n- One task at a time via subagents\n- Per-task review: spec compliance then code quality\n\nNext: Complete remaining tasks, get user approval"
    ;;
  *)
    CONTEXT="${CONTEXT}Run specdev assignment <name> to start a new assignment."
    ;;
esac

CONTEXT="${CONTEXT}\n\nAnnounce every subtask with \"Using specdev: <action>\"."

# Escape for JSON
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

ESCAPED=$(escape_for_json "$CONTEXT")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF

exit 0
```

Make it executable:
```bash
chmod +x hooks/session-start.sh
```

**Step 4: Verify hook works**

Run: `bash hooks/session-start.sh 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(typeof d === 'object' ? 'PASS' : 'FAIL')"`
Expected: PASS (outputs valid JSON)

Run from within a specdev project:
```bash
cd test-output && bash ../hooks/session-start.sh 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.hookSpecificOutput ? 'PASS' : 'FAIL')"
```
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/hooks.json hooks/session-start.sh
git commit -m "feat: add SessionStart hook for Claude Code"
```

---

### Task 9: Update `init.js` to install hook for Claude platform

When `--platform=claude`, also copy the hook files into the project's `.claude/` directory alongside skills.

**Files:**
- Modify: `src/commands/init.js`

**Step 1: Write the failing test**

Verify that `specdev init --platform=claude` installs the hook.

Run: `rm -rf /tmp/test-hook-init && node ./bin/specdev.js init --platform=claude --target=/tmp/test-hook-init && test -f /tmp/test-hook-init/.claude/hooks/specdev-session-start.sh && echo PASS || echo FAIL`
Expected: FAIL (hook not yet installed)

**Step 2: Verify fails**

Run the command above.
Expected: FAIL

**Step 3: Write minimal implementation**

Add to `src/commands/init.js` — in the `if (platform === 'claude')` block, after skill installation, add hook installation:

```js
// Install hook for claude platform
if (platform === 'claude') {
  // ... existing skill installation code ...

  // Install SessionStart hook
  const hookDir = join(targetDir, '.claude', 'hooks')
  mkdirSync(hookDir, { recursive: true })

  const hookScriptSrc = join(__dirname, '../../hooks/session-start.sh')
  const hookScriptDest = join(hookDir, 'specdev-session-start.sh')

  if (existsSync(hookScriptSrc)) {
    const hookContent = readFileSync(hookScriptSrc, 'utf-8')
    writeFileSync(hookScriptDest, hookContent, { mode: 0o755 })
    console.log('✅ Installed SessionStart hook to .claude/hooks/')
  }
}
```

Also update the SKILL_FILES in init.js:
- Update `specdev-review` skill description to match new single-command `specdev review`
- Remove references to old `specdev check`/`specdev work` commands in skill content

**Step 4: Verify hook installed**

Run: `rm -rf /tmp/test-hook-init && node ./bin/specdev.js init --platform=claude --target=/tmp/test-hook-init && test -f /tmp/test-hook-init/.claude/hooks/specdev-session-start.sh && echo PASS || echo FAIL`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/init.js
git commit -m "feat: install SessionStart hook during specdev init --platform=claude"
```

---

### Task 10: Update skill templates for new flow

Update the core skill SKILL.md files to reference new commands and remove references to the old 2-agent review flow.

**Files:**
- Modify: `templates/.specdev/skills/core/implementing/SKILL.md`
- Modify: `templates/.specdev/skills/core/brainstorming/SKILL.md`
- Modify: `templates/.specdev/skills/core/breakdown/SKILL.md`
- Modify: `templates/.specdev/skills/core/review-agent/SKILL.md`
- Modify: `templates/.specdev/_guides/task/validation_guide.md`

**Step 1: Identify all references to old commands**

Run: `grep -rn 'specdev work\|specdev check\|specdev main\|specdev review start\|specdev review accept\|specdev review reject' templates/`
Note each file:line that needs updating.

**Step 2: Update implementing/SKILL.md**

In Phase 3 (Final Review):
- Change `specdev work request` → remove (no longer needed)
- Change `specdev main request-review` → remove
- Update the flow description to match V4: after all tasks, present summary to user inline for approval

**Step 3: Update brainstorming/SKILL.md**

- If it references review flow, update to: "After design is complete, a subagent review will check the design. Then user approval is requested inline."

**Step 4: Update breakdown/SKILL.md**

- Remove `review/ready-for-review.md` and `review/watching.json` references
- Update to: "After plan is written, a subagent review (1-2 rounds) checks completeness before auto-proceeding to implementation."

**Step 5: Update review-agent/SKILL.md**

- Rewrite to describe the new `specdev review` flow: single-command, phase-aware, interactive with user
- Remove `autoreview`, `watching.json`, signal file references

**Step 6: Update validation_guide.md**

- Replace all `specdev main request-review` → describe inline approval
- Replace all `specdev review start/accept/reject` → `specdev review`

**Step 7: Verify no old references remain**

Run: `grep -rn 'specdev work\|specdev check\|specdev main \|review start\|review accept\|review reject\|poll-review\|poll-main' templates/`
Expected: No matches

**Step 8: Commit**

```bash
git add templates/
git commit -m "docs: update skill templates for V4 workflow"
```

---

### Task 11: Update init.js skill content

Update the SKILL_FILES constant in `init.js` that defines slash-command skills for Claude platform.

**Files:**
- Modify: `src/commands/init.js`

**Step 1: Update skill content**

In the `SKILL_FILES` object:

- `specdev-start`: No changes needed (already correct)
- `specdev-remind`: Remove entirely (replaced by SessionStart hook)
- `specdev-rewind`: Update to reference new commands
- `specdev-brainstorm`: Update to reference `specdev assignment`
- `specdev-continue`: Update to reference new commands, remove `specdev work` references
- `specdev-review`: Rewrite to match new single-command review

Replace `specdev-remind` with `specdev-assignment`:
```js
'specdev-assignment': `---
name: specdev-assignment
description: Create a new assignment and start the brainstorm phase
---

Run \`specdev assignment <name>\` where <name> describes the feature.

Then read \`.specdev/skills/core/brainstorming/SKILL.md\` and follow it exactly.

Announce every subtask with "Using specdev: <action>".
`,
```

Update `specdev-review`:
```js
'specdev-review': `---
name: specdev-review
description: Phase-aware manual review of the current assignment
---

Run \`specdev review\` to see the current assignment's phase and review context.

Follow the printed instructions to review the appropriate artifacts.
Discuss findings with the user before concluding.
`,
```

Update `specdev-continue`:
```js
'specdev-continue': `---
name: specdev-continue
description: Resume specdev work from where you left off
---

1. Run \`specdev start\` to check project context
2. Check the latest assignment in \`.specdev/assignments/\`
3. Determine current phase from artifacts:
   - No brainstorm artifacts → run \`specdev assignment <name>\`
   - Has design, no plan → run \`specdev breakdown\`
   - Has plan, no implementation → run \`specdev implement\`
   - Has implementation → check if all tasks complete
4. Read the skill for your current phase and continue

Announce every subtask with "Using specdev: <action>".
`,
```

**Step 2: Verify init still works**

Run: `rm -rf /tmp/test-init-skills && node ./bin/specdev.js init --platform=claude --target=/tmp/test-init-skills`
Expected: exits 0, skills installed

**Step 3: Verify no old command references in skills**

Run: `grep -rn 'specdev work\|specdev check\|specdev main ' /tmp/test-init-skills/.claude/skills/`
Expected: No matches

**Step 4: Commit**

```bash
git add src/commands/init.js
git commit -m "feat: update slash-command skills for V4 workflow"
```

---

### Task 12: Update README and package.json

Update documentation to reflect V4 commands.

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Update README.md**

Replace the Commands section with:

```markdown
## Commands

```bash
# Setup
specdev init [--platform=claude]    # Initialize .specdev in current directory
specdev update                      # Update core skills, preserve project files
specdev skills                      # List available skills

# Workflow (coding agent)
specdev start                       # Check/fill project context
specdev assignment [name]           # Create assignment, start brainstorm
specdev breakdown                   # Validate brainstorm, start breakdown
specdev implement                   # Validate plan, start implementation
specdev review                      # Phase-aware manual review (separate session)

# Knowledge
specdev ponder workflow             # Write workflow observations
specdev ponder project              # Write project-specific learnings
```
```

Update "When done:" references:
- `specdev work request` → remove (inline approval now)
- `specdev main request-review` → remove

Update the Two-Agent Architecture section to describe the new flow.

**Step 2: Update package.json test scripts**

Ensure the `test` script runs all new test files and `test:cleanup` removes all test output dirs:

```json
"test": "npm run test:init && npm run test:verify && npm run test:scan && npm run test:assignment-utils && npm run test:skills && npm run test:orientation && npm run test:tdd && npm run test:implementing && npm run test:review-agent && npm run test:parallel-worktrees && npm run test:init-platform && npm run test:start && npm run test:assignment && npm run test:breakdown && npm run test:implement && npm run test:review-cmd && npm run test:update-skills && npm run test:cleanup",
"test:start": "node ./tests/test-start.js",
"test:assignment": "node ./tests/test-assignment.js",
"test:breakdown": "node ./tests/test-breakdown.js",
"test:implement": "node ./tests/test-implement.js",
"test:review-cmd": "node ./tests/test-review-cmd.js",
```

Update `test:cleanup` to include: `./test-start-output ./test-assignment-output ./test-breakdown-output ./test-implement-output ./test-review-cmd-output`

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: update README and package.json for V4 workflow"
```

---

### Task 13: Final verification

Run full test suite and verify no old command references remain in active source files.

**Files:**
- No files modified

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Check for stale references**

Run: `grep -rn 'specdev work \|specdev check \|specdev main \|specdev remind' src/ bin/ templates/ tests/ scripts/ --include='*.js' --include='*.sh' --include='*.md'`
Expected: No matches in active source files (docs/plans/ is historical, OK to have old references)

**Step 3: Verify new commands work end-to-end**

```bash
rm -rf /tmp/test-e2e
node ./bin/specdev.js init --target=/tmp/test-e2e
node ./bin/specdev.js start --target=/tmp/test-e2e
node ./bin/specdev.js help
```

Expected: All commands run without errors

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: final V4 cleanup"
```
