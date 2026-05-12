# Architectural Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix security vulnerabilities, eliminate code duplication, improve correctness of locking and state management across the specdev-cli codebase.

**Architecture:** Extract shared utilities from work.js/check.js into a new `src/utils/assignment.js` module. Fix command injection in check.js and verify-gates.sh. Replace TOCTOU lock with atomic file creation. Use `path.basename()` everywhere instead of manual splitting. Consolidate ponder commands into a shared engine. Inline copy.js.

**Tech Stack:** Node.js ESM, fs-extra, child_process (execFileSync only)

---

### Task 1: Fix command injection in check.js (execSync → execFileSync)

**Files:**
- Modify: `src/commands/check.js:4,220-221`

**Step 1: Write the failing test**

Add a test to `tests/test-check.js` that verifies check.js no longer uses execSync.

```javascript
// In existing test file, add after imports:
import { readFileSync } from 'fs'

// Add test:
tests.push({
  name: 'check.js does not use execSync (security)',
  fn: async () => {
    const source = readFileSync(new URL('../src/commands/check.js', import.meta.url), 'utf-8')
    assert(!source.includes('execSync('), 'check.js should not use execSync — use execFileSync instead')
    assert(source.includes('execFileSync'), 'check.js should use execFileSync')
  }
})
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-check.js`
Expected: FAIL — check.js currently uses execSync

**Step 3: Write minimal implementation**

In `src/commands/check.js`, change line 4:
```javascript
// OLD:
import { execSync } from 'child_process'
// NEW:
import { execFileSync } from 'child_process'
```

Change lines 220-221:
```javascript
// OLD:
    const output = execSync(`bash "${scriptPath}" "${assignmentPath}"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    })
// NEW:
    const output = execFileSync('bash', [scriptPath, assignmentPath], {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    })
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-check.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/check.js tests/test-check.js
git commit -m "fix: command injection in check.js — switch execSync to execFileSync"
```

---

### Task 2: Fix path injection in verify-gates.sh

**Files:**
- Modify: `scripts/verify-gates.sh:125-138,166-172`

**Step 1: Write the failing test**

Add a test to `tests/test-check.js` that verifies verify-gates.sh does not interpolate paths directly into node -e strings.

```javascript
tests.push({
  name: 'verify-gates.sh does not interpolate paths into node -e (security)',
  fn: async () => {
    const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'verify-gates.sh')
    const source = readFileSync(scriptPath, 'utf-8')
    // Should not have $ASSIGNMENT_PATH inside node -e single-quoted JS strings
    // The safe pattern uses process.argv instead
    assert(!source.includes("readFileSync('$ASSIGNMENT_PATH"), 'verify-gates.sh should not interpolate $ASSIGNMENT_PATH into JS strings')
  }
})
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-check.js`
Expected: FAIL — verify-gates.sh currently interpolates $ASSIGNMENT_PATH

**Step 3: Write minimal implementation**

In `scripts/verify-gates.sh`, replace the Gate 3 inline node block (lines ~124-143) with:

```bash
  if command -v node &>/dev/null; then
    VALID=$(node -e "
      try {
        const r = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
        const required = ['version', 'assignment_id', 'assignment_path', 'gate', 'status', 'timestamp'];
        const hasRequired = required.every((k) => Object.prototype.hasOwnProperty.call(r, k));
        const validVersion = r.version === 1;
        const validId = typeof r.assignment_id === 'string' && r.assignment_id.length > 0;
        const validGate = r.gate === 'gate_3' || r.gate === 'gate_4';
        const validStatus = ['pending', 'in_progress', 'awaiting_approval', 'passed', 'failed'].includes(r.status);
        const validTimestamp = typeof r.timestamp === 'string' && !Number.isNaN(Date.parse(r.timestamp));
        const ok = hasRequired && validVersion && validId && validGate && validStatus && validTimestamp;
        console.log(ok ? 'valid' : 'invalid');
      } catch(e) { console.log('invalid'); }
    " "$ASSIGNMENT_PATH/review_request.json" 2>/dev/null)
```

Replace the Gate 4 inline node block (lines ~165-172) with:

```bash
  GATE3_STATUS=$(node -e "
    try {
      const r = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
      if (r.gate === 'gate_3') console.log(r.status);
      else console.log('n/a');
    } catch(e) { console.log('error'); }
  " "$ASSIGNMENT_PATH/review_request.json" 2>/dev/null)
```

**Step 4: Run tests to verify they pass**

Run: `node tests/test-check.js`
Expected: PASS

Run the full check test too since verify-gates.sh is exercised there:
Run: `npm run test:check`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/verify-gates.sh tests/test-check.js
git commit -m "fix: path injection in verify-gates.sh — use process.argv instead of string interpolation"
```

---

### Task 3: Fix TOCTOU race in lock mechanism

**Files:**
- Modify: `src/commands/check.js:203-212`

**Step 1: Write the failing test**

Add a test to `tests/test-check.js` that verifies atomic lock creation:

```javascript
tests.push({
  name: 'check run creates lock atomically with wx flag',
  fn: async () => {
    const source = readFileSync(new URL('../src/commands/check.js', import.meta.url), 'utf-8')
    // Should use wx flag for atomic lock creation, not pathExists + writeFile
    assert(source.includes("flag: 'wx'") || source.includes('flag: "wx"'),
      'check.js should use wx flag for atomic lock file creation')
  }
})
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-check.js`
Expected: FAIL — check.js currently uses pathExists + writeFile

**Step 3: Write minimal implementation**

In `src/commands/check.js`, replace lines 203-212 (the lock section in checkRun):

```javascript
  // Lock (atomic — wx flag fails if file exists)
  const lockPath = join(assignmentPath, 'review_request.lock')
  try {
    await fse.writeFile(lockPath, new Date().toISOString(), { flag: 'wx' })
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.error('❌ Lock file exists — another reviewer may be active')
      console.log(`   Lock: ${lockPath}`)
      console.log('   If stale, run: specdev check resume')
      process.exit(1)
    }
    throw err
  }
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-check.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/check.js tests/test-check.js
git commit -m "fix: TOCTOU race in lock mechanism — use atomic wx flag"
```

---

### Task 4: Extract shared utils into src/utils/assignment.js

**Files:**
- Create: `src/utils/assignment.js`
- Modify: `src/commands/work.js`
- Modify: `src/commands/check.js`

**Step 1: Write the failing test**

Create `tests/test-assignment-utils.js`:

```javascript
import { strict as assert } from 'assert'
import { parseAssignmentId, formatStatus, timeSince } from '../src/utils/assignment.js'

const tests = []
let passed = 0
let failed = 0

tests.push({
  name: 'parseAssignmentId parses standard format',
  fn: () => {
    const result = parseAssignmentId('00001_feature_auth')
    assert.equal(result.id, '00001')
    assert.equal(result.type, 'feature')
    assert.equal(result.label, 'auth')
  }
})

tests.push({
  name: 'parseAssignmentId handles compound labels',
  fn: () => {
    const result = parseAssignmentId('00002_bugfix_login-page')
    assert.equal(result.id, '00002')
    assert.equal(result.type, 'bugfix')
    assert.equal(result.label, 'login-page')
  }
})

tests.push({
  name: 'parseAssignmentId returns null fields for non-standard names',
  fn: () => {
    const result = parseAssignmentId('random-folder')
    assert.equal(result.id, null)
    assert.equal(result.type, null)
    assert.equal(result.label, 'random-folder')
  }
})

tests.push({
  name: 'formatStatus returns icons for known statuses',
  fn: () => {
    assert(formatStatus('pending').includes('pending'))
    assert(formatStatus('in_progress').includes('in_progress'))
    assert(formatStatus('passed').includes('passed'))
    assert(formatStatus('failed').includes('failed'))
    assert(formatStatus('awaiting_approval').includes('awaiting_approval'))
  }
})

tests.push({
  name: 'formatStatus returns raw string for unknown status',
  fn: () => {
    assert.equal(formatStatus('unknown_thing'), 'unknown_thing')
  }
})

tests.push({
  name: 'timeSince returns human-readable duration',
  fn: () => {
    const now = new Date()
    const thirtySecsAgo = new Date(now - 30000).toISOString()
    const fiveMinsAgo = new Date(now - 300000).toISOString()
    const twoHoursAgo = new Date(now - 7200000).toISOString()

    assert(timeSince(thirtySecsAgo).endsWith('s ago'))
    assert(timeSince(fiveMinsAgo).endsWith('m ago'))
    assert(timeSince(twoHoursAgo).endsWith('h ago'))
  }
})

for (const test of tests) {
  try {
    await test.fn()
    passed++
    console.log(`  ✅ ${test.name}`)
  } catch (err) {
    failed++
    console.log(`  ❌ ${test.name}: ${err.message}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-assignment-utils.js`
Expected: FAIL — module doesn't exist yet

**Step 3: Write minimal implementation**

Create `src/utils/assignment.js`:

```javascript
import { join, basename } from 'path'
import fse from 'fs-extra'
import { findLatestAssignment } from './scan.js'

/**
 * Parse assignment directory name into components
 * e.g. "00001_feature_auth" -> { id: "00001", type: "feature", label: "auth" }
 */
export function parseAssignmentId(name) {
  const match = name.match(/^(\d+)_(\w+?)_(.+)$/)
  if (match) return { id: match[1], type: match[2], label: match[3] }
  return { id: null, type: null, label: name }
}

/**
 * Resolve assignment path from flags (--assignment or latest)
 */
export async function resolveAssignmentPath(flags) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  if (flags.assignment) {
    const assignmentPath = join(specdevPath, 'assignments', flags.assignment)
    if (!(await fse.pathExists(assignmentPath))) {
      console.error(`❌ Assignment not found: ${flags.assignment}`)
      process.exit(1)
    }
    return assignmentPath
  }

  const latest = await findLatestAssignment(specdevPath)
  if (!latest) {
    console.error('❌ No assignments found')
    process.exit(1)
  }
  return latest.path
}

/**
 * Get the assignment directory name from a full path
 */
export function assignmentName(assignmentPath) {
  return basename(assignmentPath)
}

/**
 * Format review status with icon
 */
export function formatStatus(status) {
  const icons = {
    pending: '⏳ pending',
    in_progress: '🔄 in_progress',
    awaiting_approval: '👀 awaiting_approval',
    passed: '✅ passed',
    failed: '❌ failed',
  }
  return icons[status] || status
}

/**
 * Human-readable time since an ISO timestamp
 */
export function timeSince(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-assignment-utils.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/assignment.js tests/test-assignment-utils.js
git commit -m "feat: extract shared assignment utils into src/utils/assignment.js"
```

---

### Task 5: Rewire work.js to use shared utils

**Files:**
- Modify: `src/commands/work.js`

**Step 1: Run existing tests as baseline**

Run: `npm run test:work`
Expected: PASS (baseline)

**Step 2: Rewrite work.js to use shared utils**

Replace the local `resolveAssignmentPath`, `parseAssignmentId`, `formatStatus`, `timeSince` functions and all `.split(/[/\\]/).pop()` calls.

New imports at top of `src/commands/work.js`:
```javascript
import { join, relative } from 'path'
import fse from 'fs-extra'
import { execFileSync } from 'child_process'
import { findLatestAssignment } from '../utils/scan.js'
import { resolveAssignmentPath, parseAssignmentId, assignmentName, formatStatus, timeSince } from '../utils/assignment.js'
```

Remove these local functions entirely:
- `resolveAssignmentPath` (lines 29-54)
- `parseAssignmentId` (lines 56-60)
- `formatStatus` (lines 199-208)
- `timeSince` (lines 210-216)

Replace every `assignmentPath.split(/[/\\]/).pop()` with `assignmentName(assignmentPath)`. Occurrences:
- Line 92: `const assignmentName = assignmentPath.split(/[/\\]/).pop()` → `const name = assignmentName(assignmentPath)`
- Line 157: same pattern → `const name = assignmentName(assignmentPath)`

Note: since `findLatestAssignment` is no longer used directly (it's used inside `resolveAssignmentPath` in the shared module), remove that import too.

**Step 3: Run tests to verify they pass**

Run: `npm run test:work`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/work.js
git commit -m "refactor: work.js uses shared assignment utils, removes duplicated code"
```

---

### Task 6: Rewire check.js to use shared utils

**Files:**
- Modify: `src/commands/check.js`

**Step 1: Run existing tests as baseline**

Run: `npm run test:check`
Expected: PASS (baseline)

**Step 2: Rewrite check.js to use shared utils**

New imports at top of `src/commands/check.js`:
```javascript
import { join } from 'path'
import { fileURLToPath } from 'url'
import fse from 'fs-extra'
import { execFileSync } from 'child_process'
import { findLatestAssignment } from '../utils/scan.js'
import { resolveAssignmentPath, assignmentName, formatStatus, timeSince } from '../utils/assignment.js'
```

Remove these local functions entirely:
- `resolveAssignmentPath` (lines 42-66)
- `formatStatus` (lines 443-452)
- `timeSince` (lines 454-460)

Replace every `assignmentPath.split(/[/\\]/).pop()` with `assignmentName(assignmentPath)`. Occurrences at lines: 143, 148, 253, 299, 393, 434.

Keep `findPendingReview` as-is (it's check-specific).

Note: `findLatestAssignment` is still needed by `findPendingReview` — wait, actually `findPendingReview` doesn't use it. Check if `findLatestAssignment` is still directly imported. It's used inside `resolveAssignmentPath` in the shared module. The import of `findLatestAssignment` can be removed from check.js since the shared `resolveAssignmentPath` handles it.

**Step 3: Run tests to verify they pass**

Run: `npm run test:check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/check.js
git commit -m "refactor: check.js uses shared assignment utils, removes duplicated code"
```

---

### Task 7: Remove unused parseAssignmentName from scan.js

**Files:**
- Modify: `src/utils/scan.js`

**Step 1: Check that parseAssignmentName is not exported**

Verify `scan.js` — `parseAssignmentName` is a private function used only by `scanSingleAssignment` and `findLatestAssignment`. It cannot be removed since it's used internally. However, the logic is now duplicated with `assignment.js:parseAssignmentId`.

Make `scanSingleAssignment` and `findLatestAssignment` import from the shared module instead:

```javascript
import { parseAssignmentId } from './assignment.js'
```

Replace calls to `parseAssignmentName(name)` with `parseAssignmentId(name)` at lines 49 and 219.

Remove the local `parseAssignmentName` function (lines 92-98).

**Step 2: Run tests to verify they pass**

Run: `npm run test:scan`
Expected: PASS

Run: `npm run test:work && npm run test:check`
Expected: PASS (regression check)

**Step 3: Commit**

```bash
git add src/utils/scan.js
git commit -m "refactor: scan.js uses shared parseAssignmentId, removes duplicate"
```

---

### Task 8: Inline copy.js into init.js

**Files:**
- Modify: `src/commands/init.js`
- Delete: `src/utils/copy.js`

**Step 1: Run existing tests as baseline**

Run: `npm run test:init && npm run test:verify`
Expected: PASS

**Step 2: Inline the copy logic**

In `src/commands/init.js`, replace the import and usage:

```javascript
// Remove this import:
// import { copySpecdev } from '../utils/copy.js'

// Add fse import:
import fse from 'fs-extra'
```

Replace the `await copySpecdev(templatePath, specdevPath, force)` call (line 81) with:

```javascript
    if (force) {
      await fse.remove(specdevPath)
    }
    await fse.copy(templatePath, specdevPath, {
      overwrite: force,
      errorOnExist: !force,
    })
```

Delete `src/utils/copy.js`.

**Step 3: Run tests to verify they pass**

Run: `npm run test:init && npm run test:verify`
Expected: PASS

**Step 4: Verify no other imports of copy.js**

Run: `grep -r "copy.js" src/` — should return nothing.

**Step 5: Commit**

```bash
git rm src/utils/copy.js
git add src/commands/init.js
git commit -m "refactor: inline copy.js into init.js — single call site didn't justify a module"
```

---

### Task 9: DRY the platform adapters in init.js

**Files:**
- Modify: `src/commands/init.js:10-47`

**Step 1: Run existing tests as baseline**

Run: `npm run test:init-platform`
Expected: PASS

**Step 2: Simplify adapter definitions**

Replace lines 10-47 with:

```javascript
function adapterContent(heading) {
  return `# ${heading}\n\nRead \`.specdev/_main.md\` for the full SpecDev workflow and rules.\n`
}

const ADAPTERS = {
  claude:  { path: 'CLAUDE.md',           heading: 'CLAUDE.md' },
  codex:   { path: 'AGENTS.md',           heading: 'AGENTS.md' },
  cursor:  { path: join('.cursor', 'rules'), heading: 'Cursor Rules' },
  generic: { path: 'AGENTS.md',           heading: 'AGENTS.md' },
}
```

Then where `adapter.content` is used (line ~93), change to:
```javascript
writeFileSync(adapterPath, adapterContent(adapter.heading), 'utf-8')
```

**Step 3: Run tests to verify they pass**

Run: `npm run test:init-platform`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/init.js
git commit -m "refactor: DRY platform adapters in init.js — template function replaces 4 identical blocks"
```

---

### Task 10: Add test-assignment-utils to npm test pipeline

**Files:**
- Modify: `package.json`

**Step 1: Add the test script**

In `package.json` scripts, add after `"test:check"`:
```json
"test:assignment-utils": "node ./tests/test-assignment-utils.js",
```

And update the `"test"` script to include it after `test:scan`:
```
npm run test:init && npm run test:verify && npm run test:scan && npm run test:assignment-utils && npm run test:skills && ...
```

**Step 2: Run the full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test-assignment-utils to CI test pipeline"
```

---

## Summary

| Task | Type | What |
|------|------|------|
| 1 | Security fix | check.js execSync → execFileSync |
| 2 | Security fix | verify-gates.sh path injection |
| 3 | Correctness fix | TOCTOU lock race → atomic wx |
| 4 | New module | Extract src/utils/assignment.js |
| 5 | Refactor | Rewire work.js |
| 6 | Refactor | Rewire check.js |
| 7 | Refactor | Remove scan.js duplicate |
| 8 | Simplify | Inline copy.js |
| 9 | DRY | Adapter templates |
| 10 | CI | Wire new test into pipeline |
