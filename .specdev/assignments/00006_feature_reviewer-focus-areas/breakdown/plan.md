# Reviewer Focus Areas Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add round-specific review focus instructions via shared config and increase max_rounds to 5.

**Architecture:** A shared `review-focus.json` maps round numbers to focus text. `reviewloop.js` reads this and passes `SPECDEV_FOCUS` env var to reviewer subprocesses. `review.js` reads the env var and displays it. All reviewer configs get `max_rounds: 5`.

**Tech Stack:** Node.js ESM, JSON config, existing test harness

---

### Task 1: Create review-focus.json and add to templates
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop.js` (modify — add review-focus.json assertions)
- Create: `templates/.specdev/skills/core/reviewloop/review-focus.json`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop.js` after the claude.json test block (after the `}` closing the `if (existsSync(claudeConfig))` block):

```javascript
const focusConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'review-focus.json')
assert(existsSync(focusConfig), 'review-focus.json exists after init')

if (existsSync(focusConfig)) {
  const focusContent = JSON.parse(readFileSync(focusConfig, 'utf-8'))
  assert(focusContent.round_focus, 'review-focus.json has round_focus object')
  assert(typeof focusContent.round_focus['1'] === 'string', 'review-focus.json has round 1 focus')
  assert(typeof focusContent.round_focus['2'] === 'string', 'review-focus.json has round 2 focus')
  assert(typeof focusContent.round_focus['3'] === 'string', 'review-focus.json has round 3 focus')
  assert(typeof focusContent.round_focus.default === 'string', 'review-focus.json has default focus')
}
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop.js`
Expected: FAIL with "review-focus.json exists after init"

**Step 3: Write minimal implementation**

Create `templates/.specdev/skills/core/reviewloop/review-focus.json`:

```json
{
  "round_focus": {
    "1": "Architecture & structure — review modularity, separation of concerns, API design, and dependency direction. Identify structural issues.",
    "2": "Code efficiency — eliminate dead code, replace imperative loops with functional alternatives, extract magic numbers into constants, prefer pure functions with minimal side effects, verify Big O complexity of algorithms.",
    "3": "Domain & task-specific — verify implementation matches the spec/design, check edge cases, validate error handling.",
    "default": "General review — catch anything missed in previous rounds."
  }
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop.js`
Expected: PASS

**Step 5: Commit**
```
git add templates/.specdev/skills/core/reviewloop/review-focus.json tests/test-reviewloop.js
git commit -m "feat: add review-focus.json with round-specific focus areas"
```

---

### Task 2: Update max_rounds to 5 in all reviewer configs
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop.js` (modify — update max_rounds assertions)
- Modify: `templates/.specdev/skills/core/reviewloop/reviewers/codex.json`
- Modify: `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`
- Modify: `templates/.specdev/skills/core/reviewloop/reviewers/claude.json`
- Modify: `.specdev/skills/core/reviewloop/reviewers/codex.json`
- Modify: `.specdev/skills/core/reviewloop/reviewers/cursor.json`
- Modify: `.specdev/skills/core/reviewloop/reviewers/cursor-gemini.json`
- Modify: `.specdev/skills/core/reviewloop/reviewers/claude.json`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop.js` after the review-focus.json test block:

```javascript
console.log('\nreviewer max_rounds check:')
const reviewersDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
const reviewerFiles = ['codex.json', 'cursor.json', 'claude.json']
for (const file of reviewerFiles) {
  const filePath = join(reviewersDir, file)
  if (existsSync(filePath)) {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert(content.max_rounds === 5, `${file} has max_rounds=5`)
  }
}
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop.js`
Expected: FAIL with "codex.json has max_rounds=5" (currently 3)

**Step 3: Write minimal implementation**

Update all reviewer JSON files to `"max_rounds": 5`:

`templates/.specdev/skills/core/reviewloop/reviewers/codex.json`:
```json
{
  "name": "codex",
  "command": "codex exec --full-auto --ephemeral \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`:
```json
{
  "name": "cursor",
  "command": "cursor-agent -f -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`templates/.specdev/skills/core/reviewloop/reviewers/claude.json`:
```json
{
  "name": "claude",
  "command": "claude --dangerously-skip-permissions -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`.specdev/skills/core/reviewloop/reviewers/codex.json`:
```json
{
  "name": "codex",
  "command": "codex exec --full-auto --ephemeral \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`.specdev/skills/core/reviewloop/reviewers/cursor.json`:
```json
{
  "name": "cursor",
  "command": "cursor-agent -f -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`.specdev/skills/core/reviewloop/reviewers/cursor-gemini.json`:
```json
{
  "name": "cursor-gemini",
  "command": "cursor-agent -f -m gemini-3.1-pro -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

`.specdev/skills/core/reviewloop/reviewers/claude.json`:
```json
{
  "name": "claude",
  "command": "claude --dangerously-skip-permissions -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 5
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop.js`
Expected: PASS

**Step 5: Commit**
```
git add templates/.specdev/skills/core/reviewloop/reviewers/*.json .specdev/skills/core/reviewloop/reviewers/*.json tests/test-reviewloop.js
git commit -m "feat: increase max_rounds to 5 for all reviewers"
```

---

### Task 3: Add focus resolution utility function
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Create: `tests/test-review-focus.js`
- Create: `src/utils/review-focus.js`

**Step 1: Write the failing test**

Create `tests/test-review-focus.js`:

```javascript
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoundFocus } from '../src/utils/review-focus.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-review-focus-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true }) }

cleanup()

// Setup: create a test review-focus.json
const reviewloopDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop')
mkdirSync(reviewloopDir, { recursive: true })

const focusConfig = {
  round_focus: {
    '1': 'Architecture focus',
    '2': 'Efficiency focus',
    '3': 'Domain focus',
    'default': 'General focus'
  }
}
writeFileSync(join(reviewloopDir, 'review-focus.json'), JSON.stringify(focusConfig))

console.log('\nresolveRoundFocus — with config:')
const specdevPath = join(TEST_DIR, '.specdev')

let result = await resolveRoundFocus(specdevPath, 1)
assert(result === 'Architecture focus', 'round 1 returns architecture focus')

result = await resolveRoundFocus(specdevPath, 2)
assert(result === 'Efficiency focus', 'round 2 returns efficiency focus')

result = await resolveRoundFocus(specdevPath, 3)
assert(result === 'Domain focus', 'round 3 returns domain focus')

result = await resolveRoundFocus(specdevPath, 4)
assert(result === 'General focus', 'round 4 falls back to default')

result = await resolveRoundFocus(specdevPath, 5)
assert(result === 'General focus', 'round 5 falls back to default')

// Test missing file
console.log('\nresolveRoundFocus — missing file:')
const emptyDir = join(TEST_DIR, 'empty', '.specdev')
mkdirSync(emptyDir, { recursive: true })
result = await resolveRoundFocus(emptyDir, 1)
assert(result === '', 'missing file returns empty string')

// Test malformed JSON
console.log('\nresolveRoundFocus — malformed JSON:')
const badDir = join(TEST_DIR, 'bad', '.specdev', 'skills', 'core', 'reviewloop')
mkdirSync(badDir, { recursive: true })
writeFileSync(join(badDir, 'review-focus.json'), '{invalid json}')
result = await resolveRoundFocus(join(TEST_DIR, 'bad', '.specdev'), 1)
assert(result === '', 'malformed JSON returns empty string')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-review-focus.js`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/utils/review-focus.js`:

```javascript
import { join } from 'path'
import fse from 'fs-extra'

/**
 * Resolve the focus instruction for a given review round.
 * Reads review-focus.json from the reviewloop skill directory.
 * Returns empty string on missing file, malformed JSON, or missing round key.
 */
export async function resolveRoundFocus(specdevPath, round) {
  const focusPath = join(specdevPath, 'skills', 'core', 'reviewloop', 'review-focus.json')

  if (!(await fse.pathExists(focusPath))) return ''

  let config
  try {
    config = await fse.readJson(focusPath)
  } catch {
    console.warn(`Warning: invalid review-focus.json at ${focusPath}`)
    return ''
  }

  const roundFocus = config.round_focus
  if (!roundFocus) return ''

  return roundFocus[String(round)] || roundFocus.default || ''
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-review-focus.js`
Expected: PASS

**Step 5: Commit**
```
git add src/utils/review-focus.js tests/test-review-focus.js
git commit -m "feat: add resolveRoundFocus utility for review focus areas"
```

---

### Task 4: Wire SPECDEV_FOCUS into reviewloop.js
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Create: `tests/test-reviewloop-focus.js`
- Modify: `src/commands/reviewloop.js`

**Step 1: Write the failing test**

Create `tests/test-reviewloop-focus.js`:

```javascript
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-focus-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true }) }

cleanup()

// Init a test project
spawnSync('node', [CLI, 'init', `--target=${TEST_DIR}`], { encoding: 'utf-8' })

// Create a test reviewer that echoes SPECDEV_FOCUS to a file
const reviewersDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
const echoReviewer = {
  name: 'echo-focus',
  command: `echo "$SPECDEV_FOCUS" > ${join(TEST_DIR, 'focus-output.txt')}`,
  max_rounds: 5
}
writeFileSync(join(reviewersDir, 'echo-focus.json'), JSON.stringify(echoReviewer))

// Create a minimal assignment
const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', '00001_feature_test')
mkdirSync(join(assignmentDir, 'brainstorm'), { recursive: true })
mkdirSync(join(assignmentDir, 'review'), { recursive: true })
writeFileSync(join(assignmentDir, 'brainstorm', 'proposal.md'), '# Test')
writeFileSync(join(assignmentDir, 'brainstorm', 'design.md'), '# Test Design')

// Write .current
writeFileSync(join(TEST_DIR, '.specdev', '.current'), '00001_feature_test')

// Write a fake feedback file so we can test round 1 focus
// (reviewer won't write real feedback, so reviewloop will error — but we capture the env var before that)

console.log('\nreviewloop SPECDEV_FOCUS integration:')

const result = spawnSync('node', [CLI, 'reviewloop', 'brainstorm', '--reviewer=echo-focus', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000
})

// The reviewloop will error because echo-focus doesn't write feedback, but SPECDEV_FOCUS should have been set
const focusOutputPath = join(TEST_DIR, 'focus-output.txt')
if (existsSync(focusOutputPath)) {
  const focusOutput = readFileSync(focusOutputPath, 'utf-8').trim()
  assert(focusOutput.includes('Architecture'), 'round 1 SPECDEV_FOCUS contains Architecture')
} else {
  assert(false, 'round 1 SPECDEV_FOCUS was set (focus-output.txt not created)')
}

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-focus.js`
Expected: FAIL (SPECDEV_FOCUS not set yet)

**Step 3: Write minimal implementation**

In `src/commands/reviewloop.js`, add the import at the top:

```javascript
import { resolveRoundFocus } from '../utils/review-focus.js'
```

In the assignment path, after `await writeCurrent(specdevPath, name)` (around line 312) and before building `childEnv`, add focus resolution:

```javascript
  // Resolve round focus
  const focusText = await resolveRoundFocus(specdevPath, round)
```

Update `childEnv` to include `SPECDEV_FOCUS`:

```javascript
  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
    SPECDEV_FOCUS: focusText,
  }
```

In the discussion path, after deriving `round` (around line 126) and before building `childEnv` (around line 141), add the same:

```javascript
  const focusText = await resolveRoundFocus(join(targetDir, '.specdev'), round)
```

Update discussion `childEnv` to include `SPECDEV_FOCUS`:

```javascript
  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: 'discussion',
    SPECDEV_ASSIGNMENT: discussionName,
    SPECDEV_DISCUSSION: discussionId,
    SPECDEV_ROUND: String(round),
    SPECDEV_FOCUS: focusText,
  }
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-focus.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/reviewloop.js tests/test-reviewloop-focus.js
git commit -m "feat: wire SPECDEV_FOCUS env var into reviewloop"
```

---

### Task 5: Display focus in review.js and add local review-focus.json
**Mode:** full
**Skills:** test-driven-development
**Files:**
- Modify: `tests/test-reviewloop-focus.js` (add review.js display test)
- Modify: `src/commands/review.js`
- Create: `.specdev/skills/core/reviewloop/review-focus.json`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop-focus.js` before the cleanup at the end:

```javascript
console.log('\nreview.js SPECDEV_FOCUS display:')

const reviewResult = spawnSync('node', [CLI, 'review', 'brainstorm', '--round=1', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000,
  env: { ...process.env, SPECDEV_FOCUS: 'Test focus instruction' }
})
assert(reviewResult.stdout.includes('Review Focus'), 'review output includes Review Focus header')
assert(reviewResult.stdout.includes('Test focus instruction'), 'review output includes focus text')

const reviewNoFocus = spawnSync('node', [CLI, 'review', 'brainstorm', '--round=1', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000,
  env: { ...process.env, SPECDEV_FOCUS: '' }
})
assert(!reviewNoFocus.stdout.includes('Review Focus'), 'review output omits Review Focus when empty')
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-focus.js`
Expected: FAIL with "review output includes Review Focus header"

**Step 3: Write minimal implementation**

In `src/commands/review.js`, after the `printLines` block for the check items in both the brainstorm (around line 170) and implementation (around line 187) sections, add:

For brainstorm phase (after line 170, after the `printLines` for Check items):
```javascript
    // Display round focus if set via reviewloop
    const focus = process.env.SPECDEV_FOCUS
    if (focus) {
      blankLine()
      printSection('Review Focus:')
      console.log(`   ${focus}`)
    }
```

For implementation phase (after line 187, after the `printLines` for Check items):
```javascript
    // Display round focus if set via reviewloop
    const focus = process.env.SPECDEV_FOCUS
    if (focus) {
      blankLine()
      printSection('Review Focus:')
      console.log(`   ${focus}`)
    }
```

For discussion phase (after line 92, after the `printLines` for Check items):
```javascript
    // Display round focus if set via reviewloop
    const focus = process.env.SPECDEV_FOCUS
    if (focus) {
      blankLine()
      printSection('Review Focus:')
      console.log(`   ${focus}`)
    }
```

Also create `.specdev/skills/core/reviewloop/review-focus.json` (local copy, identical to template):

```json
{
  "round_focus": {
    "1": "Architecture & structure — review modularity, separation of concerns, API design, and dependency direction. Identify structural issues.",
    "2": "Code efficiency — eliminate dead code, replace imperative loops with functional alternatives, extract magic numbers into constants, prefer pure functions with minimal side effects, verify Big O complexity of algorithms.",
    "3": "Domain & task-specific — verify implementation matches the spec/design, check edge cases, validate error handling.",
    "default": "General review — catch anything missed in previous rounds."
  }
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-focus.js`
Expected: PASS

**Step 5: Run full test suite**
Run: `npm test`
Expected: PASS

**Step 6: Commit**
```
git add src/commands/review.js .specdev/skills/core/reviewloop/review-focus.json tests/test-reviewloop-focus.js
git commit -m "feat: display SPECDEV_FOCUS in review output"
```
