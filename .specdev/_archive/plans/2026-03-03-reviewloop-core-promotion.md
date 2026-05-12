# Reviewloop Core Promotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move reviewloop from an optional tool skill to a core skill, and replace fireperp placeholder references with mock-tool in tests.

**Architecture:** Move the reviewloop directory from `skills/tools/` to `skills/core/` in both the live `.specdev/` and `templates/`. Update all source code, tests, and docs that reference the old path. Add migration cleanup so existing installs are cleaned up on `specdev update`.

**Tech Stack:** Node.js, shell scripts, JSON configs

---

### Task 1: Move reviewloop directories

**Files:**
- Move: `.specdev/skills/tools/reviewloop/` → `.specdev/skills/core/reviewloop/`
- Move: `templates/.specdev/skills/tools/reviewloop/` → `templates/.specdev/skills/core/reviewloop/`
- Modify: `.specdev/skills/tools/reviewloop/SKILL.md` frontmatter (now at core path)
- Modify: `templates/.specdev/skills/tools/reviewloop/SKILL.md` frontmatter (now at core path)

**Step 1: Move the live reviewloop directory**

```bash
git mv .specdev/skills/tools/reviewloop .specdev/skills/core/reviewloop
```

**Step 2: Move the template reviewloop directory**

```bash
git mv templates/.specdev/skills/tools/reviewloop templates/.specdev/skills/core/reviewloop
```

**Step 3: Update frontmatter in both SKILL.md files**

In `.specdev/skills/core/reviewloop/SKILL.md` and `templates/.specdev/skills/core/reviewloop/SKILL.md`, change:
```yaml
type: tool
```
to:
```yaml
type: core
```

**Step 4: Update script path reference in SKILL.md**

In both SKILL.md files, update the protocol example command from:
```
bash .specdev/skills/tools/reviewloop/scripts/reviewloop.sh
```
to:
```
bash .specdev/skills/core/reviewloop/scripts/reviewloop.sh
```

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: move reviewloop from tools/ to core/"
```

---

### Task 2: Update source code references

**Files:**
- Modify: `src/commands/reviewloop.js:63,80,88` — reviewers path and printed instructions
- Modify: `src/utils/update.js:5,29-35` — remove from OFFICIAL_TOOL_SKILLS, add to removePaths
- Modify: `src/commands/help.js` — no change needed (uses "reviewloop" not the path)

**Step 1: Update reviewloop.js reviewers path**

In `src/commands/reviewloop.js`, line 63, change:
```javascript
const reviewersDir = join(targetDir, '.specdev', 'skills', 'tools', 'reviewloop', 'reviewers')
```
to:
```javascript
const reviewersDir = join(targetDir, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
```

**Step 2: Update reviewloop.js error message**

Line 80, change:
```
Add reviewer JSON configs to .specdev/skills/tools/reviewloop/reviewers/
```
to:
```
Add reviewer JSON configs to .specdev/skills/core/reviewloop/reviewers/
```

**Step 3: Update reviewloop.js script path in printed instructions**

Line 88, change:
```
bash .specdev/skills/tools/reviewloop/scripts/reviewloop.sh \\
```
to:
```
bash .specdev/skills/core/reviewloop/scripts/reviewloop.sh \\
```

**Step 4: Update update.js — remove OFFICIAL_TOOL_SKILLS**

Change line 5 from:
```javascript
const OFFICIAL_TOOL_SKILLS = ['reviewloop']
```
to:
```javascript
const OFFICIAL_TOOL_SKILLS = []
```

**Step 5: Update update.js — add old reviewloop path to removePaths**

Add `'skills/tools/reviewloop'` to the `removePaths` array (around line 29-35):
```javascript
const removePaths = [
  '_router.md',
  '_guides/task',
  '_guides/workflow',
  'skills/core/orientation',
  'skills/tools/autoloop',
  'skills/tools/reviewloop',
]
```

**Step 6: Commit**

```bash
git add src/commands/reviewloop.js src/utils/update.js && git commit -m "refactor: update reviewloop path references to core/"
```

---

### Task 3: Update active-tools.json and wrapper cleanup

**Files:**
- Modify: `.specdev/skills/active-tools.json` — remove reviewloop entry
- Delete: `.claude/skills/reviewloop/SKILL.md` — stale wrapper

**Step 1: Remove reviewloop from active-tools.json**

Replace the entire file content with:
```json
{
  "tools": {},
  "agents": [
    "claude-code"
  ]
}
```

**Step 2: Delete the stale wrapper**

```bash
rm -rf .claude/skills/reviewloop
```

**Step 3: Add migration cleanup in update.js for wrapper removal**

In `src/utils/update.js`, inside the `updateSkillFiles` function, after the deprecated skills removal loop (after line 163), add cleanup for the reviewloop wrapper:

```javascript
// Remove stale reviewloop wrapper (promoted to core skill)
const reviewloopWrapper = join(skillsDir, 'reviewloop')
if (existsSync(reviewloopWrapper)) {
  rmSync(reviewloopWrapper, { recursive: true, force: true })
}
```

**Step 4: Add migration cleanup for active-tools.json reviewloop entry**

In `src/utils/update.js`, in the `updateSpecdevSystem` function, after the removePaths loop (after line 41), add:

```javascript
// Remove reviewloop from active-tools.json (promoted to core)
const activeToolsPath = join(destination, 'skills', 'active-tools.json')
if (await fse.pathExists(activeToolsPath)) {
  try {
    const activeTools = JSON.parse(await fse.readFile(activeToolsPath, 'utf-8'))
    if (activeTools.tools && activeTools.tools.reviewloop) {
      delete activeTools.tools.reviewloop
      await fse.writeFile(activeToolsPath, JSON.stringify(activeTools, null, 2) + '\n')
    }
  } catch { /* ignore parse errors */ }
}
```

**Step 5: Commit**

```bash
git add -A && git commit -m "fix: clean up reviewloop wrapper and active-tools entry on migration"
```

---

### Task 4: Update skills README

**Files:**
- Modify: `.specdev/skills/README.md`

**Step 1: Add reviewloop to core skills listing**

After the "Supporting:" section (after line 27), add:

```markdown
**Automated review:**
- `core/reviewloop/` — External CLI review loop (fix-resubmit until pass)
```

**Step 2: Commit**

```bash
git add .specdev/skills/README.md && git commit -m "docs: add reviewloop to core skills listing"
```

---

### Task 5: Update verify-output.js to check core reviewloop path

**Files:**
- Modify: `tests/verify-output.js`

**Step 1: Add reviewloop core skill entries to requiredFiles array**

After the parallel-worktrees entries (around line 70), add:

```javascript
// Reviewloop skill (directory-based, core)
'.specdev/skills/core/reviewloop/SKILL.md',
'.specdev/skills/core/reviewloop/scripts/reviewloop.sh',
'.specdev/skills/core/reviewloop/reviewers/codex.json',
'.specdev/skills/core/reviewloop/reviewers/codex-with-context.json',
```

**Step 2: Run tests to verify**

```bash
npm run test:init && npm run test:verify
```

Expected: PASS — init creates the files in the core path now.

**Step 3: Commit**

```bash
git add tests/verify-output.js && git commit -m "test: verify reviewloop exists at core/ path"
```

---

### Task 6: Update test-reviewloop-install.js

**Files:**
- Modify: `tests/test-reviewloop-install.js`

The test currently validates reviewloop as a tool skill install (wrapper creation, active-tools tracking). Since reviewloop is now core, this test should validate it exists as a core skill after init instead.

**Step 1: Rewrite the test**

Replace the entire file content to test that:
1. After init, `.specdev/skills/core/reviewloop/SKILL.md` exists
2. After init, `.specdev/skills/core/reviewloop/scripts/reviewloop.sh` exists
3. After init, `.specdev/skills/core/reviewloop/reviewers/codex.json` exists
4. SKILL.md has `type: core` in frontmatter
5. No reviewloop entry in active-tools.json
6. No `.claude/skills/reviewloop/` wrapper created

```javascript
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-install-output')

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

// Init project
runCmd(['init', `--target=${TEST_DIR}`])

// Verify reviewloop exists as core skill
console.log('\nreviewloop as core skill:')
const skillMd = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists at core/ path')

const scriptPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'scripts', 'reviewloop.sh')
assert(existsSync(scriptPath), 'reviewloop.sh script exists')

const defaultConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'codex.json')
assert(existsSync(defaultConfig), 'codex.json reviewer config exists')

// Verify frontmatter says core
const skillContent = readFileSync(skillMd, 'utf-8')
assert(skillContent.includes('type: core'), 'SKILL.md has type: core')
assert(skillContent.includes('name: reviewloop'), 'SKILL.md has name: reviewloop')

// No reviewloop in active-tools.json
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
if (existsSync(activeToolsPath)) {
  const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
  assert(activeTools.tools['reviewloop'] === undefined, 'reviewloop not in active-tools.json')
} else {
  assert(true, 'reviewloop not in active-tools.json (no active-tools.json)')
}

// No wrapper in .claude/skills/
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'reviewloop', 'SKILL.md')
assert(!existsSync(wrapperPath), 'no .claude/skills/reviewloop/ wrapper')

// Not in tools/ path
const oldPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
assert(!existsSync(oldPath), 'not present at old tools/ path')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run the test**

```bash
npm run test:reviewloop-install
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add tests/test-reviewloop-install.js && git commit -m "test: update reviewloop-install test for core skill"
```

---

### Task 7: Update test-update-skills.js

**Files:**
- Modify: `tests/test-update-skills.js:70-81`

**Step 1: Update the "official tool skills" test section**

The test on lines 70-81 validates that `specdev update` restores a tampered reviewloop in `skills/tools/`. Since reviewloop is now core (and `skills/core` is already a system path that gets overwritten), this test should validate that reviewloop at `skills/core/reviewloop/` is restored on update, and that `skills/tools/reviewloop/` is removed.

Replace lines 70-81 with:

```javascript
// ---- Test update restores core reviewloop skill ----
console.log('\nupdate restores core reviewloop:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const reviewloopSkillPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
writeFileSync(reviewloopSkillPath, '# tampered reviewloop skill\n')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with tampered core reviewloop')
const reviewloopAfterUpdate = readFileSync(reviewloopSkillPath, 'utf-8')
assert(reviewloopAfterUpdate.includes('name: reviewloop'), 'core reviewloop skill restored after update')
assert(!reviewloopAfterUpdate.includes('tampered reviewloop'), 'tampered core reviewloop content replaced')
```

**Step 2: Add test for old tools/ path cleanup**

After the above test, add:

```javascript
// ---- Test update removes old tools/reviewloop path ----
console.log('\nupdate removes old tools/reviewloop:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

// Simulate old install with reviewloop in tools/
const oldReviewloopDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
mkdirSync(oldReviewloopDir, { recursive: true })
writeFileSync(join(oldReviewloopDir, 'SKILL.md'), '# old reviewloop\n')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with old tools/reviewloop')
assert(!existsSync(oldReviewloopDir), 'old tools/reviewloop removed by update')
```

**Step 3: Run test**

```bash
npm run test:update-skills
```

Expected: All PASS.

**Step 4: Commit**

```bash
git add tests/test-update-skills.js && git commit -m "test: update reviewloop tests for core promotion"
```

---

### Task 8: Update test-reviewloop-script.js script path

**Files:**
- Modify: `tests/test-reviewloop-script.js:7`

**Step 1: Update the SCRIPT path constant**

Line 7, change:
```javascript
const SCRIPT = join(__dirname, '..', 'templates', '.specdev', 'skills', 'tools', 'reviewloop', 'scripts', 'reviewloop.sh')
```
to:
```javascript
const SCRIPT = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'reviewloop', 'scripts', 'reviewloop.sh')
```

**Step 2: Run test**

```bash
npm run test:reviewloop-script
```

Expected: All 40 PASS.

**Step 3: Commit**

```bash
git add tests/test-reviewloop-script.js && git commit -m "test: update reviewloop script path to core/"
```

---

### Task 9: Replace fireperp with mock-tool in tests

**Files:**
- Modify: `tests/test-wrappers.js` — replace all `fireperp` with `mock-tool`
- Modify: `tests/test-active-tools.js` — replace all `fireperp` with `mock-tool`
- Modify: `tests/test-frontmatter.js` — replace all `fireperp` with `mock-tool`

**Step 1: Replace in test-wrappers.js**

Replace all occurrences of `fireperp` with `mock-tool` (11 occurrences).
Replace `'Web search via Perplexity API'` with `'A mock tool for testing'`.
Replace `'Fireperp'` with `'Mock Tool'`.
Replace `'Use for researching topics, looking up API docs, verifying facts.'` with `'A mock tool skill used for testing.'`.

**Step 2: Replace in test-active-tools.js**

Replace all occurrences of `fireperp` with `mock-tool` (4 occurrences).

**Step 3: Replace in test-frontmatter.js**

Replace all occurrences of `fireperp` with `mock-tool` (3 occurrences).
Replace `'Web search'` with `'A mock tool'` in the frontmatter test string.
Replace `"web search"` with `"mock search"` in the triggers keywords array.
Replace `"fact-check"` with `"mock-check"` in the triggers operations array.
Replace `"PERPLEXITY_API_KEY"` with `"MOCK_API_KEY"`.
Replace `"which fire"` with `"which mock-tool"`.
Replace the smoke command `"fire perplexity 'test' --max-tokens 10"` with `"mock-tool run 'test' --max-tokens 10"`.

**Step 4: Run all three tests**

```bash
npm run test:wrappers && npm run test:active-tools && npm run test:frontmatter
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add tests/test-wrappers.js tests/test-active-tools.js tests/test-frontmatter.js && git commit -m "test: replace fireperp placeholder with mock-tool"
```

---

### Task 10: Run full test suite and fix any failures

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 2: If any failures, fix them**

Common issues to check:
- `test:init-platform` may check for tool skill installation output (reviewloop install message)
- `test:skills` may list reviewloop differently now
- `package.json` test cleanup paths may need updating

**Step 3: Final commit if fixes needed**

```bash
git add -A && git commit -m "fix: resolve remaining test failures after reviewloop core promotion"
```
