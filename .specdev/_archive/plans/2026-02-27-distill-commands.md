# Distill Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace interactive `ponder` commands with agent-driven `distill` commands that output JSON for coding agent consumption.

**Architecture:** Two new command files (`distill-project.js`, `distill-workflow.js`) port the scan+heuristic logic from the old ponder commands but output JSON instead of using interactive readline prompts. A third command (`distill-mark.js`) lets the agent mark assignments as processed. Dispatch routing uses the same subcommand pattern as `ponder`. The old ponder commands are deleted.

**Tech Stack:** Node.js, fs-extra, existing `src/utils/scan.js` utilities (`scanAssignments`, `readProcessedCaptures`, `markCapturesProcessed`, `readKnowledgeBranch`)

---

### Task 1: Create distill-workflow command with tests

**Mode:** full
**Files:**
- Create: `src/commands/distill-workflow.js`
- Create: `tests/test-distill-workflow.js`

**Step 1: Write the failing test**

Create `tests/test-distill-workflow.js`:

```js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-distill-workflow-output')

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

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-a')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })

// Write a workflow diff capture
writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), `# Workflow Diff — test-a
## What Worked
- TDD approach was effective
## What Didn't
- Brainstorm phase felt too long
`)

// Test 1: Output is valid JSON
console.log('\ndistill workflow — valid JSON output:')
let result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
assert(result.status === 0, 'exits with code 0')
let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 100))
}

// Test 2: Has expected fields
assert(json.status === 'ok', 'status is ok')
assert(typeof json.scanned === 'number', 'has scanned count')
assert(typeof json.unprocessed === 'number', 'has unprocessed count')
assert(Array.isArray(json.suggestions), 'has suggestions array')
assert(json.knowledge_path !== undefined, 'has knowledge_path')

// Test 3: Capture diff appears in suggestions
const captureSuggestion = json.suggestions.find(s => s.source === 'capture-diff')
assert(captureSuggestion !== undefined, 'capture diff surfaces as suggestion')
assert(captureSuggestion.body.includes('TDD approach'), 'suggestion body includes diff content')

// Test 4: Running again still shows unprocessed (not marked yet)
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed >= 1, 'unprocessed stays until mark-processed is called')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-distill-workflow.js`
Expected: FAIL — `distill` command not recognized

**Step 3: Write minimal implementation**

Create `src/commands/distill-workflow.js`:

```js
import { join } from 'path'
import fse from 'fs-extra'
import {
  scanAssignments,
  readProcessedCaptures,
} from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

export async function distillWorkflowCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')
  const feedbackDir = join(knowledgePath, '_workflow_feedback')

  const assignments = await scanAssignments(specdevPath)
  const processed = await readProcessedCaptures(knowledgePath, 'workflow')
  const unprocessed = assignments.filter(a => !processed.has(a.name))

  const suggestions = [
    ...generateWorkflowSuggestions(unprocessed),
    ...generateCaptureWorkflowSuggestions(unprocessed),
  ]

  // List existing feedback files
  let existingFiles = []
  if (await fse.pathExists(feedbackDir)) {
    existingFiles = (await fse.readdir(feedbackDir))
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
  }

  const output = {
    status: 'ok',
    scanned: assignments.length,
    unprocessed: unprocessed.length,
    existing_knowledge: existingFiles,
    suggestions,
    knowledge_path: '.specdev/knowledge/_workflow_feedback/',
  }

  console.log(JSON.stringify(output, null, 2))
}

function generateWorkflowSuggestions(assignments) {
  const suggestions = []

  // Check for skipped phases
  const skippedPhaseCounts = {}
  for (const a of assignments) {
    for (const phase of a.skippedPhases) {
      skippedPhaseCounts[phase] = (skippedPhaseCounts[phase] || 0) + 1
    }
  }

  for (const [phase, count] of Object.entries(skippedPhaseCounts)) {
    if (count >= 2) {
      suggestions.push({
        title: `${phase} phase frequently skipped`,
        body: `The "${phase}" phase was skipped in ${count} of ${assignments.length} assignments.\n` +
          `This may indicate the guide for this phase is too heavyweight.\n` +
          `Assignments: ${assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name).join(', ')}`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name),
      })
    }
  }

  // Check for assignments without context tracking
  const noContext = assignments.filter(a => !a.context)
  if (noContext.length > 0) {
    suggestions.push({
      title: 'Assignments missing context tracking',
      body: `${noContext.length} assignment(s) have no context/ directory.\n` +
        `Assignments: ${noContext.map(a => a.name).join(', ')}`,
      source: 'heuristic',
      assignments: noContext.map(a => a.name),
    })
  }

  // Check for high inter-agent message volume
  const highMessages = assignments.filter(a => a.context && a.context.messageCount > 5)
  if (highMessages.length > 0) {
    suggestions.push({
      title: 'High inter-agent message volume',
      body: `${highMessages.length} assignment(s) had more than 5 inter-agent messages.\n` +
        `Assignments: ${highMessages.map(a => `${a.name} (${a.context.messageCount} messages)`).join(', ')}`,
      source: 'heuristic',
      assignments: highMessages.map(a => a.name),
    })
  }

  return suggestions
}

function generateCaptureWorkflowSuggestions(assignments) {
  const suggestions = []

  for (const a of assignments) {
    if (!a.capture || !a.capture.workflowDiff) continue

    suggestions.push({
      title: `Workflow diff from ${a.name}`,
      body: a.capture.workflowDiff,
      source: 'capture-diff',
      assignments: [a.name],
    })
  }

  return suggestions
}
```

Then add routing in `src/commands/dispatch.js`. Replace the `ponder` block (lines 33-45) with a `distill` block:

```js
import { distillWorkflowCommand } from './distill-workflow.js'

// In dispatchCommand, replace the ponder block:
if (command === 'distill') {
  const subcommand = positionalArgs[0]
  if (subcommand === 'workflow') {
    await distillWorkflowCommand(flags)
  } else if (subcommand === 'project') {
    // TODO: Task 2
  } else if (subcommand === 'mark-processed') {
    // TODO: Task 3
  } else {
    console.error(`Unknown distill subcommand: ${subcommand || '(none)'}`)
    console.log('Usage: specdev distill <project|workflow|mark-processed>')
    process.exitCode = 1
  }
  return
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-distill-workflow.js`
Expected: PASS (all assertions)

**Step 5: Commit**

```bash
git add src/commands/distill-workflow.js src/commands/dispatch.js tests/test-distill-workflow.js
git commit -m "feat: add specdev distill workflow command with JSON output"
```

---

### Task 2: Create distill-project command with tests

**Mode:** full
**Files:**
- Create: `src/commands/distill-project.js`
- Create: `tests/test-distill-project.js`

**Step 1: Write the failing test**

Create `tests/test-distill-project.js`:

```js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-distill-project-output')

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

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-proj')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
mkdirSync(join(assignmentDir, 'context'), { recursive: true })

// Write a project-notes diff capture
writeFileSync(join(assignmentDir, 'capture', 'project-notes-diff.md'), `# Project Notes Diff
## Gaps Found
- big_picture.md should mention the new auth system
`)

// Write decisions
writeFileSync(join(assignmentDir, 'context', 'decisions.md'), `# Decisions
- Chose JWT over session cookies for stateless auth
`)

// Test 1: Output is valid JSON with expected fields
console.log('\ndistill project — valid JSON output:')
let result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
assert(result.status === 0, 'exits with code 0')
let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 100))
}

// Test 2: Has expected schema
assert(json.status === 'ok', 'status is ok')
assert(typeof json.scanned === 'number', 'has scanned count')
assert(typeof json.unprocessed === 'number', 'has unprocessed count')
assert(typeof json.existing_knowledge === 'object', 'has existing_knowledge')
assert(Array.isArray(json.suggestions), 'has suggestions array')
assert(typeof json.knowledge_paths === 'object', 'has knowledge_paths')

// Test 3: Capture diff appears in suggestions with branch
const captureSuggestion = json.suggestions.find(s => s.source === 'capture-diff')
assert(captureSuggestion !== undefined, 'capture diff surfaces as suggestion')
assert(captureSuggestion.branch !== undefined, 'capture suggestion has branch field')
assert(captureSuggestion.body.includes('auth system'), 'suggestion body includes diff content')

// Test 4: existing_knowledge has all four branches
const branches = ['codestyle', 'architecture', 'domain', 'workflow']
for (const b of branches) {
  assert(Array.isArray(json.existing_knowledge[b]), `existing_knowledge has ${b} branch`)
}

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-distill-project.js`
Expected: FAIL — `distill project` subcommand not implemented

**Step 3: Write minimal implementation**

Create `src/commands/distill-project.js`:

```js
import { join } from 'path'
import fse from 'fs-extra'
import {
  scanAssignments,
  readProcessedCaptures,
  readKnowledgeBranch,
} from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const KNOWLEDGE_BRANCHES = ['codestyle', 'architecture', 'domain', 'workflow']

export async function distillProjectCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')

  const assignments = await scanAssignments(specdevPath)
  const processed = await readProcessedCaptures(knowledgePath, 'project')
  const unprocessed = assignments.filter(a => !processed.has(a.name))

  // Read existing knowledge
  const existingKnowledge = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    const entries = await readKnowledgeBranch(knowledgePath, branch)
    existingKnowledge[branch] = entries.map(e => e.file)
  }

  const suggestions = [
    ...generateProjectSuggestions(unprocessed, existingKnowledge),
    ...generateCaptureDiffSuggestions(unprocessed),
  ]

  const knowledgePaths = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    knowledgePaths[branch] = `.specdev/knowledge/${branch}/`
  }

  const output = {
    status: 'ok',
    scanned: assignments.length,
    unprocessed: unprocessed.length,
    existing_knowledge: existingKnowledge,
    suggestions,
    knowledge_paths: knowledgePaths,
  }

  console.log(JSON.stringify(output, null, 2))
}

function generateProjectSuggestions(assignments, existingKnowledge) {
  const suggestions = []

  // Analyze assignment types
  const typeCounts = {}
  for (const a of assignments) {
    if (a.type) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
    }
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count >= 2) {
      suggestions.push({
        branch: 'workflow',
        title: `Recurring ${type} assignments`,
        body: `${count} "${type}" assignments found.\n` +
          `Consider documenting common patterns for this type of work.\n` +
          `Assignments: ${assignments.filter(a => a.type === type).map(a => a.name).join(', ')}`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.type === type).map(a => a.name),
      })
    }
  }

  // Check decisions for architectural patterns
  const withDecisions = assignments.filter(a => a.context && a.context.hasDecisions)
  if (withDecisions.length > 0 && existingKnowledge.architecture.length === 0) {
    suggestions.push({
      branch: 'architecture',
      title: 'Capture architectural decisions',
      body: `${withDecisions.length} assignment(s) contain decisions but no architecture knowledge exists.\n` +
        `Assignments: ${withDecisions.map(a => a.name).join(', ')}`,
      source: 'heuristic',
      assignments: withDecisions.map(a => a.name),
    })
  }

  // Suggest codestyle if 3+ assignments and no codestyle knowledge
  if (assignments.length >= 3 && existingKnowledge.codestyle.length === 0) {
    suggestions.push({
      branch: 'codestyle',
      title: 'Document code style patterns',
      body: `${assignments.length} assignments completed but no codestyle knowledge documented.`,
      source: 'heuristic',
      assignments: assignments.map(a => a.name),
    })
  }

  // Check for domain-specific assignments
  const domainRelated = assignments.filter(a => a.label && a.label.length > 0)
  if (domainRelated.length >= 2 && existingKnowledge.domain.length === 0) {
    suggestions.push({
      branch: 'domain',
      title: 'Capture domain concepts',
      body: `Assignments reference domain areas but no domain knowledge documented.`,
      source: 'heuristic',
      assignments: domainRelated.map(a => a.name),
    })
  }

  return suggestions
}

function generateCaptureDiffSuggestions(assignments) {
  const suggestions = []

  for (const a of assignments) {
    if (!a.capture || !a.capture.projectNotesDiff) continue

    suggestions.push({
      branch: 'architecture',
      title: `Capture diff from ${a.name}`,
      body: a.capture.projectNotesDiff,
      source: 'capture-diff',
      assignments: [a.name],
    })
  }

  return suggestions
}
```

Then wire it into `dispatch.js` — replace the `// TODO: Task 2` comment with:

```js
await distillProjectCommand(flags)
```

And add the import at the top of dispatch.js:

```js
import { distillProjectCommand } from './distill-project.js'
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-distill-project.js`
Expected: PASS (all assertions)

**Step 5: Commit**

```bash
git add src/commands/distill-project.js src/commands/dispatch.js tests/test-distill-project.js
git commit -m "feat: add specdev distill project command with JSON output"
```

---

### Task 3: Create distill mark-processed command with tests

**Mode:** full
**Files:**
- Create: `src/commands/distill-mark.js`
- Create: `tests/test-distill-mark.js`

**Step 1: Write the failing test**

Create `tests/test-distill-mark.js`:

```js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-distill-mark-output')

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

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_mark-test')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), '# Workflow Diff\n## What Worked\n- Tests\n')

// Before marking: distill should show unprocessed
console.log('\ndistill mark-processed — before marking:')
let result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
let json = JSON.parse(result.stdout.trim())
assert(json.unprocessed >= 1, 'assignment is unprocessed before marking')

// Mark it as processed
console.log('\ndistill mark-processed workflow:')
result = runCmd(['distill', 'mark-processed', 'workflow', '00001_feature_mark-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed exits with code 0')

// After marking: distill should show 0 unprocessed
console.log('\ndistill workflow — after marking:')
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'assignment is processed after marking')
assert(json.suggestions.length === 0, 'no suggestions after marking')

// Mark-processed with multiple assignments (comma-separated)
const assignmentDir2 = join(specdev, 'assignments', '00002_feature_mark-test-2')
mkdirSync(join(assignmentDir2, 'capture'), { recursive: true })
writeFileSync(join(assignmentDir2, 'capture', 'project-notes-diff.md'), '# Diff\n## Gaps\n- Missing docs\n')

result = runCmd(['distill', 'mark-processed', 'project', '00001_feature_mark-test,00002_feature_mark-test-2', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed handles comma-separated assignments')

result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'both assignments marked as processed for project')

// Error cases
console.log('\ndistill mark-processed — error cases:')
result = runCmd(['distill', 'mark-processed', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails without type argument')

result = runCmd(['distill', 'mark-processed', 'invalid', 'foo', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with invalid type')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-distill-mark.js`
Expected: FAIL — `mark-processed` subcommand not implemented

**Step 3: Write minimal implementation**

Create `src/commands/distill-mark.js`:

```js
import { join } from 'path'
import { markCapturesProcessed } from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const VALID_TYPES = ['project', 'workflow']

export async function distillMarkCommand(positionalArgs = [], flags = {}) {
  const type = positionalArgs[0]
  const assignmentList = positionalArgs[1]

  if (!type) {
    console.error('Missing required type argument')
    console.log('Usage: specdev distill mark-processed <project|workflow> <assignment1,assignment2,...>')
    process.exitCode = 1
    return
  }

  if (!VALID_TYPES.includes(type)) {
    console.error(`Invalid type: ${type}`)
    console.log(`Valid types: ${VALID_TYPES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!assignmentList) {
    console.error('Missing required assignment names')
    console.log('Usage: specdev distill mark-processed <project|workflow> <assignment1,assignment2,...>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')
  const assignments = assignmentList.split(',').map(s => s.trim()).filter(Boolean)

  await markCapturesProcessed(knowledgePath, type, assignments)

  console.log(JSON.stringify({
    status: 'ok',
    type,
    marked: assignments,
  }, null, 2))
}
```

Wire into `dispatch.js` — replace `// TODO: Task 3` with:

```js
const markArgs = positionalArgs.slice(1) // skip 'mark-processed' from positionalArgs
await distillMarkCommand(markArgs, flags)
```

And add the import:

```js
import { distillMarkCommand } from './distill-mark.js'
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-distill-mark.js`
Expected: PASS (all assertions)

**Step 5: Commit**

```bash
git add src/commands/distill-mark.js src/commands/dispatch.js tests/test-distill-mark.js
git commit -m "feat: add specdev distill mark-processed command"
```

---

### Task 4: Remove ponder commands and update dispatch, help, package.json

**Mode:** full
**Files:**
- Delete: `src/commands/ponder-project.js`
- Delete: `src/commands/ponder-workflow.js`
- Modify: `src/commands/dispatch.js`
- Modify: `src/commands/help.js`
- Modify: `package.json`

**Step 1: Write the failing test**

No new test file — we verify by running the full test suite and checking that ponder is gone from help output. Add a quick assertion to the distill-workflow test (append before cleanup):

```js
// Verify ponder is removed
console.log('\nponder removed:')
result = runCmd(['ponder', 'workflow', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'ponder command no longer exists')
assert(result.stderr.includes('Unknown command'), 'ponder shows unknown command error')
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-distill-workflow.js`
Expected: FAIL — ponder still exists

**Step 3: Remove ponder and update files**

Delete `src/commands/ponder-project.js` and `src/commands/ponder-workflow.js`.

In `src/commands/dispatch.js`:
- Remove the two ponder imports (`ponderWorkflowCommand`, `ponderProjectCommand`)
- Remove the entire `if (command === 'ponder')` block (lines 33-45)
- The `distill` block already handles the new routing

In `src/commands/help.js`, replace the ponder lines:
```
    '  ponder workflow     Interactive: review & write workflow feedback',
    '  ponder project      Interactive: review & write local project knowledge',
```
with:
```
    '  distill project     Aggregate project knowledge from assignments (JSON)',
    '  distill workflow    Aggregate workflow observations from assignments (JSON)',
    '  distill mark-processed <type> <names>  Mark assignments as distilled',
```

In `package.json`:
- Add test scripts:
  ```
  "test:distill-workflow": "node ./tests/test-distill-workflow.js",
  "test:distill-project": "node ./tests/test-distill-project.js",
  "test:distill-mark": "node ./tests/test-distill-mark.js",
  ```
- Add them to the `test` runner chain (append before `npm run test:cleanup`)
- Add cleanup paths to `test:cleanup`: `./tests/test-distill-workflow-output ./tests/test-distill-project-output ./tests/test-distill-mark-output`
- Remove any ponder-related test scripts if they exist

**Step 4: Run test to verify it passes**

Run: `node tests/test-distill-workflow.js && node tests/test-distill-project.js && node tests/test-distill-mark.js`
Expected: All PASS

**Step 5: Commit**

```bash
git rm src/commands/ponder-project.js src/commands/ponder-workflow.js
git add src/commands/dispatch.js src/commands/help.js package.json tests/test-distill-workflow.js
git commit -m "refactor: replace ponder commands with distill, update help and test scripts"
```

---

### Task 5: Run full test suite and fix any issues

**Mode:** lightweight
**Files:**
- Possibly modify: any files with test failures

**Step 1: Run the full test suite**

Run: `npm test`
Expected: All test scripts pass with 0 failures

**Step 2: Fix any failures**

If any tests reference ponder commands or expect ponder behavior, update them to use distill instead. Common suspects:
- `tests/test-continue.js` — may reference ponder in expected output
- `tests/verify-output.js` — check for ponder-related file expectations

**Step 3: Run again to confirm**

Run: `npm test`
Expected: All pass

**Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve test failures after ponder-to-distill migration"
```
