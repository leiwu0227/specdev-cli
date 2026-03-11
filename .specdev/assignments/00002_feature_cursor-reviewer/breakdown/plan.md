# Cursor Reviewer Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add Cursor CLI (`cursor-agent`) as a reviewer option for specdev's reviewloop system.

**Architecture:** Config-driven — add a JSON file to `templates/.specdev/skills/core/reviewloop/reviewers/`. The existing reviewloop infrastructure auto-discovers and validates reviewer configs. No code changes to core modules.

**Tech Stack:** Node.js CLI, JSON config, existing test harness

---

### Task 1: Add cursor.json reviewer config template
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`, Modify `tests/test-reviewloop.js`

**Step 1: Write the failing test**
In `tests/test-reviewloop.js`, add after the `codex.json reviewer config exists` assertion (line 36):

```javascript
const cursorConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'cursor.json')
assert(existsSync(cursorConfig), 'cursor.json reviewer config exists')

const cursorContent = JSON.parse(readFileSync(cursorConfig, 'utf-8'))
assert(cursorContent.name === 'cursor', 'cursor.json has name=cursor')
assert(cursorContent.command && cursorContent.command.includes('cursor-agent'), 'cursor.json command includes cursor-agent')
assert(typeof cursorContent.max_rounds === 'number', 'cursor.json has numeric max_rounds')
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop.js`
Expected: FAIL with "cursor.json reviewer config exists"

**Step 3: Write minimal implementation**
Create `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`:

```json
{
  "name": "cursor",
  "command": "cursor-agent -f -p \"Run specdev review $SPECDEV_PHASE --assignment $SPECDEV_ASSIGNMENT --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop.js`
Expected: PASS

**Step 5: Commit**
```
git add templates/.specdev/skills/core/reviewloop/reviewers/cursor.json tests/test-reviewloop.js
git commit -m "feat: add cursor-agent reviewer config for reviewloop"
```

---

### Task 2: Add cursor to reviewloop command listing test
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**
In `tests/test-reviewloop-command.js`, after the full listing block (after the `'prints next command hint'` assertion, line 184), add:

```javascript
// After init, cursor should be in the default reviewers list
console.log('\nreviewloop listing (cursor in defaults after init):')
cleanup()
initProject()
fillBigPicture()
createAssignment(ASSIGNMENT_NAME)
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  `--assignment=${ASSIGNMENT_NAME}`,
])
const cursorListOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 when listing default reviewers')
assert(cursorListOutput.includes('cursor'), 'cursor appears in default reviewer list')
assert(cursorListOutput.includes('codex'), 'codex still appears in default reviewer list')
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-command.js`
Expected: FAIL with "cursor appears in default reviewer list"

**Step 3: Write minimal implementation**
Already done in Task 1 — the `cursor.json` template is installed by `specdev init`. This test validates the integration.

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS (cursor.json is already installed by init from Task 1)

**Step 5: Commit**
```
git add tests/test-reviewloop-command.js
git commit -m "test: verify cursor appears in default reviewer listing"
```

---

### Task 3: Add checkReviewerCLIs test for cursor-agent detection
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**
In `tests/test-reviewloop-command.js`, before the "Done" section, add:

```javascript
// =====================================================================
// checkReviewerCLIs returns cursor-agent binary for cursor config
// =====================================================================

console.log('\ncheckReviewerCLIs (cursor config detection):')
cleanup()
initProject()
fillBigPicture()

// Import and test checkReviewerCLIs directly
const { checkReviewerCLIs } = await import('../src/utils/reviewers.js')
const specdevPath = join(TEST_DIR, '.specdev')
const cliResults = await checkReviewerCLIs(specdevPath)

const cursorResult = cliResults.find(r => r.name === 'cursor')
assert(cursorResult !== undefined, 'checkReviewerCLIs returns cursor entry')
assert(cursorResult.binary === 'cursor-agent', 'cursor entry has binary=cursor-agent')
assert(typeof cursorResult.found === 'boolean', 'cursor entry has boolean found field')

const codexResult = cliResults.find(r => r.name === 'codex')
assert(codexResult !== undefined, 'checkReviewerCLIs still returns codex entry')
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-command.js`
Expected: FAIL with "checkReviewerCLIs returns cursor entry"

**Step 3: Write minimal implementation**
Already done — cursor.json exists from Task 1. The `checkReviewerCLIs` function auto-discovers it.

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS

**Step 5: Run full test suite (confirm with user first)**
Pause: confirm with user before running this step.
Run: `npm test`
Expected: All tests pass

**Step 6: Commit**
```
git add tests/test-reviewloop-command.js
git commit -m "test: verify checkReviewerCLIs detects cursor-agent binary"
```
