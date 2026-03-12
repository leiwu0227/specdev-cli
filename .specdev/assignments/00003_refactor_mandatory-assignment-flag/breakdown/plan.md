# Discussions + .current Pointer Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Eliminate heuristic assignment auto-detection by introducing a `.current` pointer file for assignments and a new "discussions" concept for parallel brainstorming.

**Architecture:** The `.current` file is a plain text file at `.specdev/.current` containing the active assignment folder name. A new `focus.js` command reads/writes it. All assignment commands switch from `resolveAssignmentPath()` (which falls back to `findLatestAssignment`) to reading `.current`. Discussions are a parallel concept under `.specdev/discussions/` with `D####` IDs, managed by a new `discuss.js` command and accessed via `--discussion` flag. Exceptions: `distill` and `migrate` keep `--assignment` since they operate on specific (often non-current) assignments.

**Tech Stack:** Node.js, fs-extra, custom CLI framework (parseArgv + dispatch)

---

### Task 1: Add `.current` read/write utilities

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Create `src/utils/current.js`, Create `tests/test-current.js`

**Step 1: Write the failing test**
```javascript
// tests/test-current.js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-current')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00002_bugfix_login'), { recursive: true })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

async function main() {
  console.log('test-current.js')

  const { readCurrent, writeCurrent, clearCurrent, resolveCurrentAssignment } = await import('../src/utils/current.js')

  // Test 1: readCurrent returns null when .current doesn't exist
  setup()
  let result = await readCurrent(join(TEST_DIR, '.specdev'))
  let ok = assertTest(result === null, 'readCurrent returns null when .current missing')

  // Test 2: writeCurrent writes and readCurrent reads back
  await writeCurrent(join(TEST_DIR, '.specdev'), '00001_feature_auth')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === '00001_feature_auth', 'writeCurrent/readCurrent round-trip') && ok

  // Test 3: clearCurrent removes the file
  await clearCurrent(join(TEST_DIR, '.specdev'))
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'clearCurrent removes .current') && ok

  // Test 4: readCurrent returns null for empty file
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), '', 'utf-8')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'readCurrent returns null for empty file') && ok

  // Test 5: readCurrent trims whitespace
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), '  00001_feature_auth  \n', 'utf-8')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === '00001_feature_auth', 'readCurrent trims whitespace') && ok

  // Test 6: resolveCurrentAssignment returns path when .current is valid
  await writeCurrent(join(TEST_DIR, '.specdev'), '00001_feature_auth')
  const resolved = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(resolved !== null && resolved.name === '00001_feature_auth', 'resolveCurrentAssignment resolves valid .current') && ok

  // Test 7: resolveCurrentAssignment returns error for stale pointer
  await writeCurrent(join(TEST_DIR, '.specdev'), '00099_gone_deleted')
  const stale = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(stale !== null && stale.error === 'stale', 'resolveCurrentAssignment detects stale pointer') && ok
  // Verify it cleared the stale pointer
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'resolveCurrentAssignment clears stale pointer') && ok

  // Test 8: resolveCurrentAssignment returns error when .current missing
  const missing = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(missing !== null && missing.error === 'missing', 'resolveCurrentAssignment returns missing error') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-current.js`
Expected: FAIL — module `../src/utils/current.js` not found

**Step 3: Write minimal implementation**
```javascript
// src/utils/current.js
import { join } from 'path'
import fse from 'fs-extra'

const CURRENT_FILE = '.current'

export async function readCurrent(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (!(await fse.pathExists(filePath))) return null
  const content = (await fse.readFile(filePath, 'utf-8')).trim()
  if (!content) return null
  return content
}

export async function writeCurrent(specdevPath, assignmentName) {
  const filePath = join(specdevPath, CURRENT_FILE)
  await fse.writeFile(filePath, assignmentName, 'utf-8')
}

export async function clearCurrent(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (await fse.pathExists(filePath)) {
    await fse.remove(filePath)
  }
}

export async function resolveCurrentAssignment(specdevPath) {
  const name = await readCurrent(specdevPath)
  if (!name) return { error: 'missing' }

  const assignmentPath = join(specdevPath, 'assignments', name)
  if (!(await fse.pathExists(assignmentPath))) {
    await clearCurrent(specdevPath)
    return { error: 'stale', name }
  }

  return { name, path: assignmentPath }
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-current.js`
Expected: PASS

**Step 5: Commit**
```
git add src/utils/current.js tests/test-current.js
git commit -m "feat: add .current read/write utilities for assignment tracking"
```

---

### Task 2: Add `specdev focus` command

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Create `src/commands/focus.js`, Modify `src/commands/dispatch.js`, Create `tests/test-focus.js`

**Step 1: Write the failing test**
```javascript
// tests/test-focus.js
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-focus')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00002_bugfix_login'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'project_notes'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), 'This is a test project with sufficient content to pass the filled check.', 'utf-8')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function main() {
  console.log('test-focus.js')
  setup()

  // Test 1: specdev focus 1 sets .current
  let r = runSpecdev(['focus', '1', `--target=${TEST_DIR}`])
  let ok = assertTest(r.status === 0, 'focus 1 exits 0', r.stderr)
  const current = readFileSync(join(TEST_DIR, '.specdev', '.current'), 'utf-8')
  ok = assertTest(current === '00001_feature_auth', 'focus 1 writes correct assignment to .current') && ok

  // Test 2: specdev focus 2 switches .current
  r = runSpecdev(['focus', '2', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'focus 2 exits 0', r.stderr) && ok
  const current2 = readFileSync(join(TEST_DIR, '.specdev', '.current'), 'utf-8')
  ok = assertTest(current2 === '00002_bugfix_login', 'focus 2 writes correct assignment') && ok

  // Test 3: specdev focus --clear removes .current
  r = runSpecdev(['focus', '--clear', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'focus --clear exits 0', r.stderr) && ok
  ok = assertTest(!existsSync(join(TEST_DIR, '.specdev', '.current')), 'focus --clear removes .current') && ok

  // Test 4: specdev focus 99 errors for unknown assignment
  r = runSpecdev(['focus', '99', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'focus 99 exits non-zero') && ok
  ok = assertTest(r.stderr.includes('not found') || r.stdout.includes('not found'), 'focus 99 shows not found message') && ok

  // Test 5: specdev focus with no args errors
  r = runSpecdev(['focus', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'focus with no args exits non-zero') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-focus.js`
Expected: FAIL — Unknown command: focus

**Step 3: Write minimal implementation**
```javascript
// src/commands/focus.js
import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { writeCurrent, clearCurrent } from '../utils/current.js'
import { scanAssignments } from '../utils/scan.js'

export async function focusCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.clear) {
    await clearCurrent(specdevPath)
    console.log('Cleared active assignment.')
    return
  }

  const selector = positionalArgs[0]
  if (!selector) {
    console.error('Missing assignment ID')
    console.log('   Usage: specdev focus <id>')
    console.log('   Usage: specdev focus --clear')
    process.exitCode = 1
    return
  }

  const resolved = await resolveAssignmentSelector(specdevPath, selector)
  if (!resolved) {
    const assignments = await scanAssignments(specdevPath)
    console.error(`Assignment not found: ${selector}`)
    if (assignments.length > 0) {
      console.log('   Available:')
      for (const a of assignments) {
        console.log(`   - ${a.name}`)
      }
    }
    process.exitCode = 1
    return
  }

  if (resolved.ambiguous) {
    console.error(`Assignment ID is ambiguous: ${selector}`)
    console.log(`   Matches: ${resolved.matches.join(', ')}`)
    process.exitCode = 1
    return
  }

  await writeCurrent(specdevPath, resolved.name)
  console.log(`Focused on: ${resolved.name}`)
}
```

Add to `dispatch.js`:
```javascript
import { focusCommand } from './focus.js'
// In commandHandlers:
focus: ({ positionalArgs, flags }) => focusCommand(positionalArgs, flags),
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-focus.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/focus.js src/commands/dispatch.js tests/test-focus.js
git commit -m "feat: add specdev focus command for explicit assignment switching"
```

---

### Task 3: Update `specdev assignment` to create folder and set `.current`

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/assignment.js`, Modify `tests/test-assignment.js`

**Approach:** Add `--type` and `--slug` flags. When both are provided (automated flows), the command creates the assignment folder (with brainstorm/ and context/ subdirs) and sets `.current`. When omitted (human flow), the command reserves an ID and prints instructions as before — the human/agent then calls `specdev focus` after creating the folder manually.

**Step 1: Write the failing test**
Add to `tests/test-assignment.js`:
```javascript
// Test: specdev assignment "desc" --type=feature --slug=auth --json creates folder and sets .current
// Setup: .specdev with big_picture
// Run: specdev assignment "Add auth" --type=feature --slug=auth --target=TEST_DIR --json
// Verify:
//   - JSON output includes id, name, path
//   - Folder .specdev/assignments/NNNNN_feature_auth/ exists
//   - brainstorm/ and context/ subdirs exist
//   - .specdev/.current contains the assignment name

// Test: specdev assignment "desc" without --type/--slug still works (reserves ID, no folder creation)
// Run: specdev assignment "Add auth" --target=TEST_DIR --json
// Verify: JSON output has id but no folder created, no .current set
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-assignment.js`
Expected: FAIL — no --type/--slug handling, no folder creation

**Step 3: Write minimal implementation**
In `assignment.js`, after computing `paddedId`:
```javascript
import { writeCurrent } from '../utils/current.js'

// After computing paddedId:
const type = flags.type
const slug = flags.slug

if (type && slug) {
  const folderName = `${paddedId}_${type}_${slug}`
  const assignmentPath = join(assignmentsDir, folderName)
  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.ensureDir(join(assignmentPath, 'context'))
  await writeCurrent(specdevPath, folderName)

  if (json) {
    console.log(JSON.stringify({
      version: 1,
      status: 'ok',
      id: paddedId,
      name: folderName,
      path: assignmentPath,
      description,
      current_set: true,
    }))
    return
  }

  console.log(`Assignment ID: ${paddedId}`)
  console.log(`Created: ${folderName}/`)
  console.log(`Focused on: ${folderName}`)
  blankLine()
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  return
}

// Existing flow for when --type/--slug not provided (reserves ID only)
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-assignment.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/assignment.js tests/test-assignment.js
git commit -m "feat: assignment creates folder and sets .current when --type/--slug provided"
```

---

### Task 4: Rewrite `resolveAssignmentPath` to use `.current`

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/utils/assignment.js`, Modify `tests/test-current.js`

**Step 1: Write the failing test**
Add to `tests/test-current.js`:
```javascript
// Test: resolveAssignmentPath reads .current when set
// Setup: create .specdev with assignments, write .current
// Call resolveAssignmentPath({ target: TEST_DIR }) — should return the .current assignment path

// Test: resolveAssignmentPath errors when .current not set
// Setup: create .specdev with assignments, no .current
// Call resolveAssignmentPath({ target: TEST_DIR }) — should exit with error message

// Test: resolveAssignmentPath errors with stale .current
// Setup: write .current pointing to non-existent assignment
// Call resolveAssignmentPath({ target: TEST_DIR }) — should exit with stale error
```

Note: Since `resolveAssignmentPath` calls `process.exit(1)`, tests need to use `runSpecdev` to test these cases via a real command (e.g., `specdev checkpoint brainstorm --target=TEST_DIR`).

**Step 2: Run test to verify it fails**
Run: `node tests/test-current.js`
Expected: FAIL — resolveAssignmentPath still uses findLatestAssignment fallback

**Step 3: Write minimal implementation**
Replace `resolveAssignmentPath` in `src/utils/assignment.js`:
```javascript
import { resolveCurrentAssignment } from './current.js'

export async function resolveAssignmentPath(flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const current = await resolveCurrentAssignment(specdevPath)

  if (current.error === 'stale') {
    console.error(`❌ Active assignment "${current.name}" not found. Run specdev focus <id> to set a valid assignment.`)
    process.exit(1)
  }

  if (current.error === 'missing') {
    const assignmentsDir = join(specdevPath, 'assignments')
    if (await fse.pathExists(assignmentsDir)) {
      const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
      if (dirs.length > 0) {
        console.error('❌ No active assignment. Run specdev focus <id> to set one.')
        console.error('   Available:')
        for (const d of dirs) {
          console.error(`   - ${d}`)
        }
        process.exit(1)
      }
    }
    console.error('❌ No assignments found')
    process.exit(1)
  }

  return current.path
}
```

Remove the `findLatestAssignment` import. Remove the `flags.assignment` handling (no longer needed in this function).

**Step 4: Run test to verify it passes**
Run: `node tests/test-current.js`
Expected: PASS

**Step 5: Commit**
```
git add src/utils/assignment.js tests/test-current.js
git commit -m "refactor: resolveAssignmentPath reads .current instead of heuristic detection"
```

---

### Task 5: Remove positional assignment args from phase commands and fix `assignment.js` continue call

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/checkpoint.js`, Modify `src/commands/approve.js`, Modify `src/commands/review.js`, Modify `src/commands/reviewloop.js`, Modify `src/commands/implement.js`, Modify `src/commands/assignment.js`

**Step 1: Write the failing test**
Run `npm test` to establish baseline. Commands that previously accepted assignment as positional arg (e.g., `specdev checkpoint brainstorm 1`) will now only read `.current`.

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: Tests that pass assignment as positional arg may break

**Step 3: Write minimal implementation**
In each command, remove the pattern:
```javascript
// REMOVE this pattern from checkpoint.js, approve.js, review.js, reviewloop.js, implement.js:
if (!flags.assignment && positionalArgs[1]) {
  flags.assignment = positionalArgs[1]
}
```

Also in `assignment.js`, fix the numeric-description flow (line 68-69) that calls `continueCommand({ ...flags, assignment: existingAssignment })`. After Task 6, `continue.js` no longer reads `flags.assignment`. Fix: set `.current` via `writeCurrent` first, then call `continueCommand(flags)` without the assignment field:
```javascript
import { writeCurrent } from '../utils/current.js'

// Replace line 68-69:
if (choice === 0) {
  const specdevPath = join(targetDir, '.specdev')
  await writeCurrent(specdevPath, existingAssignment)
  await continueCommand(flags)
  return
}
```

Also verify `revise.js` and `check-review.js` work correctly via `.current` (they call `resolveAssignmentPath` and will work after Task 4, but verify they have no positional-arg patterns to remove).

Also in `checkpoint.js`, remove:
```javascript
if (flags.assignment && isAbsolute(flags.assignment)) {
  assignmentPath = flags.assignment
} else {
  assignmentPath = await resolveAssignmentPath(flags)
}
```
Replace with just:
```javascript
assignmentPath = await resolveAssignmentPath(flags)
```

**Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS (tests should not depend on positional assignment args — if they do, fix them)

**Step 5: Commit**
```
git add src/commands/checkpoint.js src/commands/approve.js src/commands/review.js src/commands/reviewloop.js src/commands/implement.js
git commit -m "refactor: remove positional assignment args from phase commands"
```

---

### Task 6: Rewrite `continue.js` to use `.current` and remove heuristic logic

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/continue.js`, Modify `tests/test-workflow.js`

**Step 1: Write the failing test**
Add to `tests/test-workflow.js` or create new test:
```javascript
// Test: specdev continue reads .current and returns assignment state
// Setup: create assignment with brainstorm artifacts, set .current
// Run: specdev continue --target=TEST_DIR --json
// Verify: JSON output contains correct assignment name and state

// Test: specdev continue errors when .current not set
// Run: specdev continue --target=TEST_DIR --json (no .current)
// Verify: JSON output contains error about no active assignment
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-workflow.js`
Expected: FAIL — continue still uses heuristic resolution

**Step 3: Write minimal implementation**
Rewrite `resolveAssignment` function in `continue.js`:
```javascript
import { resolveCurrentAssignment } from '../utils/current.js'

async function resolveAssignment(specdevPath, flags) {
  const current = await resolveCurrentAssignment(specdevPath)

  if (current.error === 'stale') {
    return {
      selected: null,
      payload: {
        version: 1,
        status: 'blocked',
        state: 'stale_current',
        blockers: [{
          code: 'stale_current',
          detail: `Active assignment "${current.name}" not found`,
          recommended_fix: 'Run specdev focus <id> to set a valid assignment',
        }],
        next_action: 'Run specdev focus <id>',
      },
    }
  }

  if (current.error === 'missing') {
    return { selected: null }
  }

  return {
    selected: { name: current.name, path: current.path },
    selectedBy: 'current',
  }
}
```

Remove:
- `statePriority` function
- `latestAssignmentArtifactMtime` function
- `ASSIGNMENT_AMBIGUITY_WINDOW_MS` constant
- `askChoice` import (no longer needed for ambiguity resolution)
- `resolveAssignmentSelector` import
- Interactive clarification logic
- Heuristic sorting/scoring logic

**Step 4: Run test to verify it passes**
Run: `node tests/test-workflow.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/continue.js tests/test-workflow.js
git commit -m "refactor: continue command reads .current, remove heuristic detection"
```

---

### Task 7: Remove `findLatestAssignment` from `scan.js`

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/utils/scan.js`, Modify `tests/test-scan.js`

**Step 1: Write the failing test**
Update `tests/test-scan.js` to remove any tests that import or test `findLatestAssignment`.

**Step 2: Run test to verify it fails**
Run: `node tests/test-scan.js`
Expected: FAIL if tests still reference removed export

**Step 3: Write minimal implementation**
Remove `findLatestAssignment` function from `scan.js`. Remove its export. Update any imports elsewhere (should be none after Task 4 removed it from `assignment.js`).

**Step 4: Run test to verify it passes**
Run: `node tests/test-scan.js`
Expected: PASS

**Step 5: Commit**
```
git add src/utils/scan.js tests/test-scan.js
git commit -m "refactor: remove findLatestAssignment from scan.js"
```

---

### Task 8: Update `reviewloop.js` to set `.current` before spawning reviewer

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/reviewloop.js`, Modify `.specdev/skills/core/reviewloop/reviewers/codex.json`, Modify `templates/.specdev/skills/core/reviewloop/reviewers/codex.json`, Modify `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`

**Step 1: Write the failing test**
```javascript
// Test: reviewloop sets .current before spawning reviewer
// After reviewloop runs, .current should still point to the assignment
// The reviewer config command should NOT use --assignment flag
```

**Step 2: Run test to verify it fails**
Expected: reviewer config still contains `--assignment $SPECDEV_ASSIGNMENT`

**Step 3: Write minimal implementation**
In `reviewloop.js`, before spawning the reviewer subprocess, ensure `.current` is set:
```javascript
import { writeCurrent } from '../utils/current.js'

// Before spawning:
const specdevPath = join(targetDir, '.specdev')
await writeCurrent(specdevPath, name)
```

Update `codex.json`:
```json
{
  "name": "codex",
  "command": "codex exec --full-auto --ephemeral \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

Remove `--assignment $SPECDEV_ASSIGNMENT` from the command. The review command will read `.current` which reviewloop just set.

Keep `SPECDEV_ASSIGNMENT` env var for informational purposes (reviewer might want to know the assignment name without reading `.current`).

Also update template files (used by `specdev init` for new projects):
- `templates/.specdev/skills/core/reviewloop/reviewers/codex.json` — same removal
- `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json` — same removal (uses `cursor-agent` command but same `--assignment $SPECDEV_ASSIGNMENT` pattern)

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/reviewloop.js .specdev/skills/core/reviewloop/reviewers/codex.json
git commit -m "refactor: reviewloop sets .current before spawning reviewer, remove --assignment from config"
```

---

### Task 9: Add discussion ID utilities

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Create `src/utils/discussion.js`, Create `tests/test-discussion.js`

**Step 1: Write the failing test**
```javascript
// tests/test-discussion.js
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-discussion')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions', 'D0002_perf-tuning', 'brainstorm'), { recursive: true })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

async function main() {
  console.log('test-discussion.js')
  const { parseDiscussionId, resolveDiscussionSelector, getNextDiscussionId } = await import('../src/utils/discussion.js')

  setup()
  let ok = true

  // Test 1: parseDiscussionId
  let parsed = parseDiscussionId('D0001_auth-ideas')
  ok = assertTest(parsed.id === 'D0001' && parsed.slug === 'auth-ideas', 'parseDiscussionId parses D0001_auth-ideas') && ok

  // Test 2: parseDiscussionId with invalid
  parsed = parseDiscussionId('foo')
  ok = assertTest(parsed.id === null, 'parseDiscussionId returns null id for invalid') && ok

  // Test 3: resolveDiscussionSelector by full name
  let resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D0001_auth-ideas')
  ok = assertTest(resolved !== null && resolved.name === 'D0001_auth-ideas', 'resolveDiscussionSelector by full name') && ok

  // Test 4: resolveDiscussionSelector by ID
  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D0001')
  ok = assertTest(resolved !== null && resolved.name === 'D0001_auth-ideas', 'resolveDiscussionSelector by ID') && ok

  // Test 5: resolveDiscussionSelector with unknown
  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D9999')
  ok = assertTest(resolved === null, 'resolveDiscussionSelector returns null for unknown') && ok

  // Test 6: resolveDiscussionSelector with malformed
  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'foo')
  ok = assertTest(resolved !== null && resolved.error === 'malformed', 'resolveDiscussionSelector returns malformed for bad ID') && ok

  // Test 7: getNextDiscussionId
  const nextId = await getNextDiscussionId(join(TEST_DIR, '.specdev'))
  ok = assertTest(nextId === 'D0003', 'getNextDiscussionId returns D0003') && ok

  // Test 8: getNextDiscussionId with no discussions
  const emptyDir = join('/tmp', 'specdev-test-discussion-empty')
  mkdirSync(join(emptyDir, '.specdev'), { recursive: true })
  const firstId = await getNextDiscussionId(join(emptyDir, '.specdev'))
  ok = assertTest(firstId === 'D0001', 'getNextDiscussionId returns D0001 when empty') && ok
  rmSync(emptyDir, { recursive: true, force: true })

  cleanup()
  if (!ok) process.exit(1)
}

main()
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-discussion.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**
```javascript
// src/utils/discussion.js
import { join } from 'path'
import fse from 'fs-extra'

export function parseDiscussionId(name) {
  const match = name.match(/^(D\d{4})_(.+)$/)
  if (match) return { id: match[1], slug: match[2] }
  return { id: null, slug: name }
}

export async function resolveDiscussionSelector(specdevPath, selector) {
  if (!/^D\d{4}/.test(selector)) {
    return { error: 'malformed', selector }
  }

  const discussionsDir = join(specdevPath, 'discussions')
  if (!(await fse.pathExists(discussionsDir))) return null

  const exactPath = join(discussionsDir, selector)
  if (await fse.pathExists(exactPath)) {
    return { name: selector, path: exactPath }
  }

  const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
  const matches = entries
    .filter(e => e.isDirectory() && e.name.startsWith(selector))
    .map(e => e.name)

  if (matches.length === 1) {
    return { name: matches[0], path: join(discussionsDir, matches[0]) }
  }

  return null
}

export async function getNextDiscussionId(specdevPath) {
  const discussionsDir = join(specdevPath, 'discussions')
  await fse.ensureDir(discussionsDir)

  const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
  const ids = entries
    .filter(e => e.isDirectory())
    .map(e => {
      const parsed = parseDiscussionId(e.name)
      return parsed.id ? Number(parsed.id.slice(1)) : 0
    })
    .filter(n => n > 0)

  const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1
  return `D${String(nextNum).padStart(4, '0')}`
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-discussion.js`
Expected: PASS

**Step 5: Commit**
```
git add src/utils/discussion.js tests/test-discussion.js
git commit -m "feat: add discussion ID parsing and resolution utilities"
```

---

### Task 10: Add `specdev discuss` command

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Create `src/commands/discuss.js`, Modify `src/commands/dispatch.js`, Create `tests/test-discuss.js`

**Step 1: Write the failing test**
```javascript
// tests/test-discuss.js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-discuss')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'project_notes'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), 'This is a test project with sufficient content to pass the filled check.', 'utf-8')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function main() {
  console.log('test-discuss.js')
  setup()

  // Test 1: specdev discuss creates discussion folder
  let r = runSpecdev(['discuss', 'auth ideas', `--target=${TEST_DIR}`, '--json'])
  let ok = assertTest(r.status === 0, 'discuss exits 0', r.stderr)
  const output = JSON.parse(r.stdout)
  ok = assertTest(output.id === 'D0001', 'discuss returns D0001') && ok
  ok = assertTest(existsSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm')), 'discuss creates folder with brainstorm subdir') && ok

  // Test 2: second discuss gets D0002
  r = runSpecdev(['discuss', 'perf tuning', `--target=${TEST_DIR}`, '--json'])
  ok = assertTest(r.status === 0, 'second discuss exits 0', r.stderr) && ok
  const output2 = JSON.parse(r.stdout)
  ok = assertTest(output2.id === 'D0002', 'second discuss returns D0002') && ok

  // Test 3: discuss --list lists discussions
  r = runSpecdev(['discuss', '--list', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'discuss --list exits 0', r.stderr) && ok
  ok = assertTest(r.stdout.includes('D0001_auth-ideas'), 'discuss --list shows D0001') && ok
  ok = assertTest(r.stdout.includes('D0002_perf-tuning'), 'discuss --list shows D0002') && ok

  // Test 4: discuss with no description errors
  r = runSpecdev(['discuss', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'discuss with no args exits non-zero') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-discuss.js`
Expected: FAIL — Unknown command: discuss

**Step 3: Write minimal implementation**
```javascript
// src/commands/discuss.js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { getNextDiscussionId } from '../utils/discussion.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { blankLine } from '../utils/output.js'

export async function discussCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.list) {
    const discussionsDir = join(specdevPath, 'discussions')
    if (!(await fse.pathExists(discussionsDir))) {
      console.log('No discussions found.')
      return
    }
    const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort()
    if (dirs.length === 0) {
      console.log('No discussions found.')
      return
    }
    console.log('Discussions:')
    for (const d of dirs) {
      console.log(`   - ${d}`)
    }
    return
  }

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled) {
    console.error('❌ big_picture.md not found or not filled in')
    process.exitCode = 1
    return
  }

  const description = positionalArgs.join(' ').trim()
  if (!description) {
    console.error('❌ No description provided')
    console.log('   Usage: specdev discuss "explore auth approaches"')
    console.log('   Usage: specdev discuss --list')
    process.exitCode = 1
    return
  }

  const nextId = await getNextDiscussionId(specdevPath)
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const folderName = `${nextId}_${slug}`
  const discussionPath = join(specdevPath, 'discussions', folderName)

  await fse.ensureDir(join(discussionPath, 'brainstorm'))

  const json = Boolean(flags.json)
  if (json) {
    console.log(JSON.stringify({
      version: 1,
      status: 'ok',
      id: nextId,
      name: folderName,
      path: discussionPath,
      description,
    }))
    return
  }

  console.log(`Discussion: ${nextId}`)
  console.log(`Description: ${description}`)
  blankLine()
  console.log(`Created: .specdev/discussions/${folderName}/`)
  blankLine()
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  console.log(`   Write artifacts to: .specdev/discussions/${folderName}/brainstorm/`)
}
```

Add to `dispatch.js`:
```javascript
import { discussCommand } from './discuss.js'
// In commandHandlers:
discuss: ({ positionalArgs, flags }) => discussCommand(positionalArgs, flags),
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-discuss.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/discuss.js src/commands/dispatch.js tests/test-discuss.js
git commit -m "feat: add specdev discuss command for parallel brainstorming"
```

---

### Task 11: Add `--discussion` support to `checkpoint`, `review`, and `reviewloop`

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/checkpoint.js`, Modify `src/commands/reviewloop.js`, Modify `src/commands/review.js`, Modify `tests/test-checkpoints.js`

**Step 1: Write the failing test**
Add to `tests/test-checkpoints.js`:
```javascript
// Test: specdev checkpoint discussion --discussion=D0001 validates brainstorm artifacts
// Setup: create .specdev/discussions/D0001_test/brainstorm/ with proposal.md and design.md
// Run: specdev checkpoint discussion --discussion=D0001 --target=TEST_DIR
// Verify: exits 0

// Test: specdev checkpoint discussion without --discussion errors
// Run: specdev checkpoint discussion --target=TEST_DIR
// Verify: exits 1 with message about --discussion being required
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-checkpoints.js`
Expected: FAIL — "discussion" not in VALID_PHASES

**Step 3: Write minimal implementation**
In `checkpoint.js`:
- Add `'discussion'` to VALID_PHASES
- When phase is `'discussion'`, require `flags.discussion` and resolve via `resolveDiscussionSelector`
- Run the same brainstorm validation logic against the discussion's brainstorm/ dir

In `reviewloop.js`:
- Add `'discussion'` to VALID_PHASES
- When phase is `'discussion'`, require `flags.discussion` and resolve the discussion path
- Create `review/` dir inside discussion, use it for feedback artifacts

In `review.js`:
- Add `'discussion'` to VALID_PHASES
- When phase is `'discussion'`, require `flags.discussion` and resolve

Error handling for all three:
```javascript
if (phase === 'discussion') {
  if (!flags.discussion) {
    console.error('--discussion flag is required. Use specdev discuss --list to see available discussions.')
    process.exitCode = 1
    return
  }
  const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
  if (!resolved || resolved.error) {
    const msg = resolved?.error === 'malformed'
      ? `Invalid discussion ID "${flags.discussion}". Expected format: D0001`
      : `Discussion ${flags.discussion} not found.`
    console.error(msg)
    process.exitCode = 1
    return
  }
  // Use resolved.path instead of assignmentPath
}
```

**Discussion checkpoint validation:** `parseAssignmentId('D0001_slug')` returns `{ id: null, type: null, label: 'D0001_slug' }` and `type` defaults to `'feature'` on line 81 of `checkpoint.js`. This means discussion brainstorm checkpoints require feature-type sections (Overview, Goals, Non-Goals, Design, Success Criteria). This is intentional — discussions follow the brainstorm skill exactly and should produce complete designs. No special validation path needed.
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-checkpoints.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/checkpoint.js src/commands/reviewloop.js src/commands/review.js tests/test-checkpoints.js
git commit -m "feat: add --discussion support to checkpoint, reviewloop, and review"
```

---

### Task 12: Add `--discussion` to `specdev assignment` for promotion

**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/assignment.js`, Modify `tests/test-assignment.js`

**Step 1: Write the failing test**
Add to `tests/test-assignment.js`:
```javascript
// Test: specdev assignment "desc" --discussion=D0001 --type=feature --slug=promoted copies brainstorm
// Setup: create discussion D0001 with proposal.md and design.md
// Run: specdev assignment "promoted feature" --discussion=D0001 --type=feature --slug=promoted --target=TEST_DIR --json
// Verify:
//   - New assignment folder has brainstorm/proposal.md and brainstorm/design.md copied from discussion
//   - .current is set to new assignment
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-assignment.js`
Expected: FAIL — no --discussion handling

**Step 3: Write minimal implementation**
In `assignment.js`, inside the `if (type && slug)` block, after creating the folder:
```javascript
import { resolveDiscussionSelector } from '../utils/discussion.js'

// After creating brainstorm/ and context/ dirs:
if (flags.discussion) {
  const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
  if (!resolved || resolved.error) {
    console.error(`❌ Discussion not found: ${flags.discussion}`)
    process.exitCode = 1
    return
  }
  const srcBrainstorm = join(resolved.path, 'brainstorm')
  const destBrainstorm = join(assignmentPath, 'brainstorm')
  if (await fse.pathExists(srcBrainstorm)) {
    await fse.copy(srcBrainstorm, destBrainstorm, { overwrite: true })
  }
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-assignment.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/assignment.js tests/test-assignment.js
git commit -m "feat: --discussion flag on assignment copies brainstorm artifacts from discussion"
```

---

### Task 13: Update existing tests for full suite pass

**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify `tests/test-workflow.js`, Modify `tests/test-scan.js`, Modify `tests/test-utils.js`, Modify `tests/test-reviewloop-command.js`, Modify `tests/test-checkpoints.js`, Modify `tests/test-approve-phase.js`

**Step 1: Run full test suite**
Run: `npm test`
Collect all failures.

**Step 2: Fix each broken test**
Common fixes needed:
- Tests that rely on auto-detection (no `--assignment` or `.current`): add `.current` file setup
- Tests that import `findLatestAssignment`: remove or replace
- Tests that use `--assignment` flag on commands that no longer accept it: set `.current` instead
- Tests for `checkpoint.js` that pass absolute paths via `flags.assignment`: use `.current`
- Verify `distill` and `migrate` tests still pass (they keep `--assignment` and don't use `resolveAssignmentPath`, so should be unaffected, but verify)
- Verify `revise` and `check-review` tests pass via `.current` (they use `resolveAssignmentPath` which now reads `.current`)

**Step 3: Run full test suite again**
Run: `npm test`
Expected: ALL PASS

**Step 4: Commit**
```
git add tests/
git commit -m "test: update all tests for .current pointer and discussion changes"
```

---

### Task 14: Update help command and `.specdev/` documentation

**Mode:** lightweight
**Files:** Modify `src/commands/help.js`, Modify `.specdev/_main.md`, Modify `.specdev/_index.md`, Modify `.specdev/_guides/workflow.md`, Modify `.specdev/_guides/assignment_guide.md`

**Step 1: Update files**

`help.js`:
- Add `focus <id>` and `discuss <desc>` commands
- Remove `--assignment=<id>` from OPTIONS
- Update WORKFLOW section with `specdev focus` and `specdev discuss`

`.specdev/_main.md`:
- Update "First Steps" to mention `specdev focus` for resuming work
- Remove references to auto-detection

`.specdev/_index.md`:
- Add `focus` and `discuss` to CLI Commands
- Note that `distill` and `migrate` still accept `--assignment`

`.specdev/_guides/workflow.md`:
- Update Phase 1 instructions to reference `specdev discuss` as an alternative to `specdev assignment` for brainstorming
- Add note about `specdev focus` for switching assignments

`.specdev/_guides/assignment_guide.md`:
- Update folder creation instructions to mention `--type`/`--slug` flags
- Document `--discussion` promotion flow

**Step 2: Commit**
```
git add src/commands/help.js .specdev/_main.md .specdev/_index.md .specdev/_guides/workflow.md .specdev/_guides/assignment_guide.md
git commit -m "docs: update help and .specdev docs for focus, discuss, and .current workflow"
```
