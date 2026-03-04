# Distill Refactoring Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Combine three distill commands into two (`specdev distill` + `specdev distill done`), integrate into knowledge-capture as a hard requirement, and add a distill-pending nudge to `specdev continue`.

**Architecture:** Replace `distill-project.js`, `distill-workflow.js`, and `distill-mark.js` with `distill.js` (combined scan + heuristics + JSON output) and `distill-done.js` (validation gate + mark-processed). Update dispatch routing, help text, continue command, and knowledge-capture SKILL.md.

**Tech Stack:** Node.js, ESM, fs-extra, node:test

---

### Task 1: Create combined distill command

**Mode:** full
**Skills:** [test-driven-development]
**Files:**
- Create: `src/commands/distill.js`
- Test: `tests/test-distill.js` (rewrite)

**Step 1: Write the failing test**

In `tests/test-distill.js`, replace all existing content with tests for the combined command:

```js
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-distill-output'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (assertTest(condition, msg)) passes++
  else failures++
}

function runCmd(args) {
  return runSpecdev(args)
}

function cleanup() { cleanupDir(TEST_DIR) }

// =====================================================================
// Combined distill command
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-a')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
mkdirSync(join(assignmentDir, 'context'), { recursive: true })

writeFileSync(join(assignmentDir, 'capture', 'project-notes-diff.md'), `# Project Notes Diff
## Gaps Found
- big_picture.md should mention the new auth system
`)

writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), `# Workflow Diff
## What Worked
- TDD approach was effective
## What Didn't
- Brainstorm phase felt too long
`)

writeFileSync(join(assignmentDir, 'context', 'decisions.md'), `# Decisions
- Chose JWT over session cookies
`)

console.log('\ndistill combined — valid JSON output:')
let result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00001_feature_test-a'])
assert(result.status === 0, 'exits with code 0')

let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 200))
}

if (json) {
  assert(json.status === 'ok', 'status is ok')
  assert(json.assignment === '00001_feature_test-a', 'has assignment name')
  assert(typeof json.capture === 'object', 'has capture object')
  assert(json.capture.project_notes_diff.includes('auth system'), 'capture includes project diff')
  assert(json.capture.workflow_diff.includes('TDD approach'), 'capture includes workflow diff')
  assert(typeof json.knowledge_files === 'object', 'has knowledge_files')
  assert(Array.isArray(json.knowledge_files.codestyle), 'has codestyle branch')
  assert(Array.isArray(json.knowledge_files._workflow_feedback), 'has _workflow_feedback branch')
  assert(typeof json.big_picture_word_count === 'number', 'has big_picture_word_count')
  assert(json.big_picture_word_limit === 2000, 'big_picture_word_limit is 2000')
  assert(Array.isArray(json.heuristics), 'has heuristics array')
}

console.log('\ndistill — missing assignment:')
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=does-not-exist'])
assert(result.status !== 0, 'fails with unknown assignment')
try {
  const errJson = JSON.parse(result.stdout.trim())
  assert(errJson.status === 'error', 'error status in JSON')
} catch {
  assert(false, 'error output is valid JSON')
}

console.log('\ndistill — missing --assignment flag:')
result = runCmd(['distill', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails without --assignment')

console.log('\ndistill — no captures:')
const noCaptureDir = join(specdev, 'assignments', '00002_feature_no-captures')
mkdirSync(noCaptureDir, { recursive: true })
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00002_feature_no-captures'])
assert(result.status === 0, 'exits 0 with no captures')
try {
  const ncJson = JSON.parse(result.stdout.trim())
  assert(ncJson.status === 'no_captures', 'status is no_captures')
} catch {
  assert(false, 'no_captures output is valid JSON')
}

console.log('\nold commands removed:')
result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'distill project no longer works')

result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'distill workflow no longer works')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-distill.js`
Expected: FAIL (distill.js doesn't exist yet, old routing still in place)

**Step 3: Write minimal implementation**

Create `src/commands/distill.js`:

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
const BIG_PICTURE_WORD_LIMIT = 2000

export async function distillCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (typeof flags.assignment !== 'string' || !flags.assignment.trim()) {
    console.error('Missing required --assignment flag')
    console.log('Usage: specdev distill --assignment=<name>')
    process.exitCode = 1
    return
  }

  const wanted = flags.assignment.trim()
  const knowledgePath = join(specdevPath, 'knowledge')

  const assignments = await scanAssignments(specdevPath)
  const match = assignments.find(a => a.name === wanted)

  if (!match) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Assignment not found: ${wanted}`,
    }, null, 2))
    process.exitCode = 1
    return
  }

  // Read capture diffs
  const capturePath = join(match.path, 'capture')
  let projectNotesDiff = null
  let workflowDiff = null

  const pndPath = join(capturePath, 'project-notes-diff.md')
  if (await fse.pathExists(pndPath)) {
    projectNotesDiff = await fse.readFile(pndPath, 'utf-8')
  }

  const wdPath = join(capturePath, 'workflow-diff.md')
  if (await fse.pathExists(wdPath)) {
    workflowDiff = await fse.readFile(wdPath, 'utf-8')
  }

  if (!projectNotesDiff && !workflowDiff) {
    console.log(JSON.stringify({
      status: 'no_captures',
      assignment: wanted,
      capture: { project_notes_diff: null, workflow_diff: null },
    }, null, 2))
    return
  }

  // Read existing knowledge file listings
  const knowledgeFiles = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    const entries = await readKnowledgeBranch(knowledgePath, branch)
    knowledgeFiles[branch] = entries.map(e => e.file)
  }

  // Workflow feedback files
  const feedbackDir = join(knowledgePath, '_workflow_feedback')
  let feedbackFiles = []
  if (await fse.pathExists(feedbackDir)) {
    feedbackFiles = (await fse.readdir(feedbackDir))
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
  }
  knowledgeFiles._workflow_feedback = feedbackFiles

  // Read big_picture word count
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  let bigPictureWordCount = 0
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    bigPictureWordCount = content.split(/\s+/).filter(Boolean).length
  }

  // Generate heuristics (combined project + workflow)
  const processed = await readProcessedCaptures(knowledgePath, 'project')
  const unprocessed = assignments.filter(a => !processed.has(a.name))
  const heuristics = [
    ...generateProjectHeuristics(unprocessed, knowledgeFiles),
    ...generateWorkflowHeuristics(unprocessed),
  ]

  const output = {
    status: 'ok',
    assignment: wanted,
    capture: {
      project_notes_diff: projectNotesDiff,
      workflow_diff: workflowDiff,
    },
    knowledge_files: knowledgeFiles,
    big_picture_path: '.specdev/project_notes/big_picture.md',
    big_picture_word_count: bigPictureWordCount,
    big_picture_word_limit: BIG_PICTURE_WORD_LIMIT,
    heuristics,
  }

  console.log(JSON.stringify(output, null, 2))
}

function generateProjectHeuristics(assignments, existingKnowledge) {
  const suggestions = []

  const typeCounts = {}
  for (const a of assignments) {
    if (a.type) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
    }
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count >= 2) {
      suggestions.push({
        title: `Recurring ${type} assignments`,
        body: `${count} "${type}" assignments found. Consider documenting common patterns.`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.type === type).map(a => a.name),
      })
    }
  }

  const withDecisions = assignments.filter(a => a.context && a.context.hasDecisions)
  if (withDecisions.length > 0 && existingKnowledge.architecture.length === 0) {
    suggestions.push({
      title: 'Capture architectural decisions',
      body: `${withDecisions.length} assignment(s) contain decisions but no architecture knowledge exists.`,
      source: 'heuristic',
      assignments: withDecisions.map(a => a.name),
    })
  }

  if (assignments.length >= 3 && existingKnowledge.codestyle.length === 0) {
    suggestions.push({
      title: 'Document code style patterns',
      body: `${assignments.length} assignments completed but no codestyle knowledge documented.`,
      source: 'heuristic',
      assignments: assignments.map(a => a.name),
    })
  }

  const domainRelated = assignments.filter(a => a.label && a.label.length > 0)
  if (domainRelated.length >= 2 && existingKnowledge.domain.length === 0) {
    suggestions.push({
      title: 'Capture domain concepts',
      body: `Assignments reference domain areas but no domain knowledge documented.`,
      source: 'heuristic',
      assignments: domainRelated.map(a => a.name),
    })
  }

  return suggestions
}

function generateWorkflowHeuristics(assignments) {
  const suggestions = []

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
        body: `The "${phase}" phase was skipped in ${count} assignments.`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name),
      })
    }
  }

  const noContext = assignments.filter(a => !a.context)
  if (noContext.length > 0) {
    suggestions.push({
      title: 'Assignments missing context tracking',
      body: `${noContext.length} assignment(s) have no context/ directory.`,
      source: 'heuristic',
      assignments: noContext.map(a => a.name),
    })
  }

  const highMessages = assignments.filter(a => a.context && a.context.messageCount > 5)
  if (highMessages.length > 0) {
    suggestions.push({
      title: 'High inter-agent message volume',
      body: `${highMessages.length} assignment(s) had more than 5 inter-agent messages.`,
      source: 'heuristic',
      assignments: highMessages.map(a => a.name),
    })
  }

  return suggestions
}
```

**Step 4: Update dispatch routing**

In `src/commands/dispatch.js`, replace the distill routing block:

```js
// Old:
if (subcommand === 'workflow') { ... }
else if (subcommand === 'project') { ... }
else if (subcommand === 'mark-processed') { ... }

// New:
if (subcommand === 'done') {
  const doneArgs = positionalArgs.slice(1)
  await distillDoneCommand(doneArgs, flags)
} else {
  // No subcommand = combined distill
  await distillCommand(flags)
}
```

Update imports accordingly (remove distill-project, distill-workflow, distill-mark; add distill, distill-done).

**Step 5: Run test to verify it passes**

Run: `node --test tests/test-distill.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/distill.js src/commands/dispatch.js tests/test-distill.js
git commit -m "feat: combine distill project/workflow into single distill command"
```

---

### Task 2: Create distill done command

**Mode:** full
**Skills:** [test-driven-development]
**Files:**
- Create: `src/commands/distill-done.js`
- Modify: `src/commands/dispatch.js`
- Test: `tests/test-distill.js` (append)

**Step 1: Write the failing test**

Append to `tests/test-distill.js` (before the cleanup/summary at the end):

```js
// =====================================================================
// Distill Done
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdevDone = join(TEST_DIR, '.specdev')
const doneDirAssignment = join(specdevDone, 'assignments', '00001_feature_done-test')
mkdirSync(join(doneDirAssignment, 'capture'), { recursive: true })
writeFileSync(join(doneDirAssignment, 'capture', 'workflow-diff.md'), '# Diff\n')

// Create big_picture.md under limit
const projectNotes = join(specdevDone, 'project_notes')
writeFileSync(join(projectNotes, 'big_picture.md'), 'A short overview of the project.\n')

// Create feature_descriptions.md with entry
writeFileSync(join(projectNotes, 'feature_descriptions.md'),
  '# Feature Descriptions\n\n### Done Test\n**Assignment:** 00001_feature_done-test\n')

console.log('\ndistill done — success:')
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'distill done exits 0')
try {
  json = JSON.parse(result.stdout.trim())
  assert(json.status === 'ok', 'distill done status ok')
  assert(json.marked === '00001_feature_done-test', 'marked correct assignment')
} catch {
  assert(false, 'distill done output is valid JSON')
}

// Verify marked as processed — distill still works but assignment is tracked
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00001_feature_done-test'])
json = JSON.parse(result.stdout.trim())
assert(json.status === 'ok' || json.status === 'no_captures', 'distill still runs on processed assignment')

console.log('\ndistill done — big_picture over limit:')
writeFileSync(join(projectNotes, 'big_picture.md'), ('word '.repeat(2001)).trim())
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails when big_picture over word limit')
assert(
  result.stderr.includes('big_picture.md') || result.stdout.includes('big_picture.md'),
  'error mentions big_picture.md'
)

console.log('\ndistill done — missing feature_descriptions entry:')
writeFileSync(join(projectNotes, 'big_picture.md'), 'Short.\n')
writeFileSync(join(projectNotes, 'feature_descriptions.md'), '# Feature Descriptions\n')
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails when assignment not in feature_descriptions')

console.log('\ndistill done — unknown assignment:')
result = runCmd(['distill', 'done', 'does-not-exist', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with unknown assignment')

console.log('\ndistill done — already processed:')
writeFileSync(join(projectNotes, 'feature_descriptions.md'),
  '# Feature Descriptions\n\n### Done Test\n**Assignment:** 00001_feature_done-test\n')
runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'already processed exits 0')

console.log('\nold mark-processed removed:')
result = runCmd(['distill', 'mark-processed', 'project', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'mark-processed no longer works')
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-distill.js`
Expected: FAIL (distill-done.js doesn't exist)

**Step 3: Write minimal implementation**

Create `src/commands/distill-done.js`:

```js
import { join } from 'path'
import fse from 'fs-extra'
import { scanAssignments, markCapturesProcessed, readProcessedCaptures } from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const BIG_PICTURE_WORD_LIMIT = 2000

export async function distillDoneCommand(positionalArgs = [], flags = {}) {
  const assignmentName = positionalArgs[0]

  if (!assignmentName) {
    console.error('Missing required assignment name')
    console.log('Usage: specdev distill done <assignment-name>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')

  // Verify assignment exists
  const assignments = await scanAssignments(specdevPath)
  const match = assignments.find(a => a.name === assignmentName)
  if (!match) {
    console.error(`Assignment not found: ${assignmentName}`)
    process.exitCode = 1
    return
  }

  // Check if already processed
  const processedProject = await readProcessedCaptures(knowledgePath, 'project')
  const processedWorkflow = await readProcessedCaptures(knowledgePath, 'workflow')
  if (processedProject.has(assignmentName) && processedWorkflow.has(assignmentName)) {
    console.log(JSON.stringify({
      status: 'ok',
      message: 'Already processed.',
      marked: assignmentName,
    }, null, 2))
    return
  }

  // Validate big_picture.md word count
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    const wordCount = content.split(/\s+/).filter(Boolean).length
    if (wordCount > BIG_PICTURE_WORD_LIMIT) {
      console.error(`big_picture.md is ${wordCount} words (limit: ${BIG_PICTURE_WORD_LIMIT}). Trim and retry.`)
      process.exitCode = 1
      return
    }
  }

  // Validate feature_descriptions.md contains assignment name
  const featureDescPath = join(specdevPath, 'project_notes', 'feature_descriptions.md')
  if (await fse.pathExists(featureDescPath)) {
    const content = await fse.readFile(featureDescPath, 'utf-8')
    if (!content.includes(assignmentName)) {
      console.error(`Assignment ${assignmentName} not found in feature_descriptions.md. Add an entry and retry.`)
      process.exitCode = 1
      return
    }
  } else {
    console.error(`feature_descriptions.md not found. Create it with an entry for ${assignmentName} and retry.`)
    process.exitCode = 1
    return
  }

  // Mark as processed for both types
  await markCapturesProcessed(knowledgePath, 'project', [assignmentName])
  await markCapturesProcessed(knowledgePath, 'workflow', [assignmentName])

  console.log(JSON.stringify({
    status: 'ok',
    marked: assignmentName,
  }, null, 2))
}
```

**Step 4: Ensure dispatch.js imports distill-done (already done in Task 1)**

**Step 5: Run test to verify it passes**

Run: `node --test tests/test-distill.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/distill-done.js tests/test-distill.js
git commit -m "feat: add distill done validation gate with word limit and catalog check"
```

---

### Task 3: Delete old distill commands and update dispatch

**Mode:** standard
**Skills:** [test-driven-development]
**Files:**
- Delete: `src/commands/distill-project.js`
- Delete: `src/commands/distill-workflow.js`
- Delete: `src/commands/distill-mark.js`
- Modify: `src/commands/dispatch.js`

**Step 1: Verify tests still reference old commands being removed**

The test file from Tasks 1-2 already asserts `distill project`, `distill workflow`, and `distill mark-processed` fail. These tests should pass after removing old files.

**Step 2: Update dispatch.js**

Replace the full distill routing block and imports. Remove imports for `distillWorkflowCommand`, `distillProjectCommand`, `distillMarkCommand`. The new routing (from Task 1) should handle `distill` (no subcommand) and `distill done`.

**Step 3: Delete old files**

```bash
rm src/commands/distill-project.js src/commands/distill-workflow.js src/commands/distill-mark.js
```

**Step 4: Run tests**

Run: `node --test tests/test-distill.js`
Expected: PASS

**Step 5: Commit**

```bash
git add -u src/commands/distill-project.js src/commands/distill-workflow.js src/commands/distill-mark.js src/commands/dispatch.js
git commit -m "refactor: remove old distill project/workflow/mark-processed commands"
```

---

### Task 4: Update help.js

**Mode:** lightweight
**Files:**
- Modify: `src/commands/help.js`

**Step 1: Update help text**

Replace the three distill entries:
```
'  distill project     Aggregate project knowledge from assignments (JSON)',
'  distill workflow    Aggregate workflow observations from assignments (JSON)',
'  distill mark-processed <type> <names>  Mark assignments as distilled',
```

With:
```
'  distill              Aggregate knowledge from assignment captures (JSON)',
'  distill done <name>  Validate and mark assignment as distilled',
```

Also update the workflow section at the bottom:
```
'  # Knowledge distillation',
'  specdev distill --assignment=<name>',
'  specdev distill done <name>',
```

**Step 2: Run full test suite**

Run: `node --test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/help.js
git commit -m "fix: update help text for combined distill commands"
```

---

### Task 5: Add distill-pending nudge to continue.js

**Mode:** standard
**Skills:** [test-driven-development]
**Files:**
- Modify: `src/commands/continue.js`
- Test: `tests/test-workflow.js` (append)

**Step 1: Write the failing test**

Append to `tests/test-workflow.js` in the continue command section:

```js
console.log('\ncontinue — distill pending nudge:')
// Create a completed assignment with capture diffs but not marked as processed
const distillAssignment = join(TEST_DIR, '.specdev', 'assignments', '00003_feature_distill-pending')
mkdirSync(join(distillAssignment, 'brainstorm'), { recursive: true })
mkdirSync(join(distillAssignment, 'breakdown'), { recursive: true })
mkdirSync(join(distillAssignment, 'implementation'), { recursive: true })
mkdirSync(join(distillAssignment, 'capture'), { recursive: true })
writeFileSync(join(distillAssignment, 'brainstorm', 'proposal.md'), '# Proposal\nContent here...\n')
writeFileSync(join(distillAssignment, 'brainstorm', 'design.md'), '# Design\nContent here...\n')
writeFileSync(join(distillAssignment, 'breakdown', 'plan.md'), '# Plan\nContent here...\n')
writeFileSync(join(distillAssignment, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }))
writeFileSync(join(distillAssignment, 'capture', 'project-notes-diff.md'), '# Diff\n')
writeFileSync(join(distillAssignment, 'capture', 'workflow-diff.md'), '# Diff\n')
writeFileSync(join(distillAssignment, 'status.json'), JSON.stringify({ brainstorm_approved: true, implementation_approved: true }))

result = runCmd(['continue', '--json', `--target=${TEST_DIR}`, '--assignment=00003_feature_distill-pending'])
json = JSON.parse(result.stdout.trim())
assert(json.distill_pending !== undefined, 'continue output includes distill_pending')
assert(json.distill_pending.count >= 1, 'distill_pending count is at least 1')
assert(Array.isArray(json.distill_pending.assignments), 'distill_pending has assignments array')
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-workflow.js`
Expected: FAIL (distill_pending not in output)

**Step 3: Implement the nudge**

In `src/commands/continue.js`:

1. Add import: `import { readProcessedCaptures } from '../utils/scan.js'`
2. In `continueCommand()`, after building the payload but before `emit()`, add:

```js
// Check for unprocessed distill assignments
const knowledgePath = join(specdevPath, 'knowledge')
const allAssignments = await scanAssignments(specdevPath)
const captureAssignments = allAssignments.filter(a => a.capture)
const processedProject = await readProcessedCaptures(knowledgePath, 'project')
const unprocessedDistill = captureAssignments.filter(a => !processedProject.has(a.name))

if (unprocessedDistill.length > 0) {
  const MAX_SHOWN = 5
  payload.distill_pending = {
    count: unprocessedDistill.length,
    assignments: unprocessedDistill.slice(0, MAX_SHOWN).map(a => a.name),
  }
}
```

3. In the `emit()` text output, after the blockers section, add:

```js
if (payload.distill_pending) {
  console.log('')
  console.log('Distill Pending:')
  const suffix = payload.distill_pending.count > 5 ? ' (showing oldest 5)' : ''
  console.log(`  ${payload.distill_pending.count} assignment(s) have unprocessed captures${suffix}`)
  console.log('  Run: specdev distill --assignment=<name>')
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-workflow.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/continue.js tests/test-workflow.js
git commit -m "feat: add distill-pending nudge to specdev continue"
```

---

### Task 6: Update knowledge-capture SKILL.md

**Mode:** lightweight
**Files:**
- Modify: `templates/.specdev/skills/core/knowledge-capture/SKILL.md`
- Modify: `.specdev/skills/core/knowledge-capture/SKILL.md`

**Step 1: Update template SKILL.md**

Replace the full content of `templates/.specdev/skills/core/knowledge-capture/SKILL.md` with the updated version:

- Step 1: Project Notes Diff (unchanged)
- Step 2: Workflow Diff (unchanged)
- Step 3: Update Big Picture (new — replaces "Do NOT update big_picture.md directly" with "Update big_picture.md directly, keep under 2000 words, architecture-level facts only")
- Step 4: Update Catalogs and Finalize (was Step 3, remove "Distill any reusable learnings" vague instruction)
- Step 5: Run Distill (new — hard requirement, run `specdev distill --assignment=<name>`, write knowledge, write workflow feedback)
- Step 6: Finalize (new — hard requirement, run `specdev distill done <name>`, retry on validation failure)

Update Red Flags:
- Remove "Updating big_picture.md directly" red flag
- Add "Skipping distill step — every assignment must run specdev distill and specdev distill done"

**Step 2: Copy to local .specdev**

Copy the same content to `.specdev/skills/core/knowledge-capture/SKILL.md`.

**Step 3: Run specdev update to verify template copies cleanly**

Run: `node bin/specdev.js update`
Expected: success, skills/core updated

**Step 4: Commit**

```bash
git add templates/.specdev/skills/core/knowledge-capture/SKILL.md .specdev/skills/core/knowledge-capture/SKILL.md
git commit -m "fix: update knowledge-capture SKILL.md with distill integration"
```

---

### Task 7: Final integration test

**Mode:** full
**Skills:** [test-driven-development]
**Files:**
- Test: `tests/test-distill.js` (verify full suite)

**Step 1: Run the full test suite**

Run: `node --test`
Expected: All tests pass, 0 failures

**Step 2: Run specdev update in both projects**

Run: `node bin/specdev.js update`
Run: `cd /mnt/h/oceanwave/lib/dataportal && node /mnt/h/oceanwave/lib/specdev-cli/bin/specdev.js update`
Expected: Both succeed, no errors

**Step 3: Smoke test the new commands**

```bash
node bin/specdev.js distill --assignment=00001_familiarization_distill-improvement
node bin/specdev.js distill done 00001_familiarization_distill-improvement
```

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test: final integration verification for distill refactoring"
```
