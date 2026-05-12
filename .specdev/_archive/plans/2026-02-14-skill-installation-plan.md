# Skill Installation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install 5 specdev slash-command skills into `.claude/skills/` during `specdev init --platform=claude`, and update them via `specdev update`.

**Architecture:** Add a `SKILL_FILES` template map to `init.js` with 5 skill file definitions. During init (claude platform only), write them to `.claude/skills/`. During update, auto-detect their presence and overwrite.

**Tech Stack:** Node.js ESM, fs-extra, fs (writeFileSync/existsSync/mkdirSync)

---

### Task 1: Add skill templates and install during init

**Files:**
- Modify: `src/commands/init.js:19-81`

**Step 1: Write the failing test**

Add tests to `tests/test-init-platform.js`. Insert before the `// ---- Test adapter does NOT overwrite existing file ----` section:

```javascript
// ---- Test --platform=claude installs skills ----
console.log('\nclaude skills installation:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
const skillsDir = join(TEST_DIR, '.claude', 'skills')
assert(existsSync(skillsDir), '.claude/skills/ directory created')
assert(existsSync(join(skillsDir, 'specdev-remind.md')), 'specdev-remind.md installed')
assert(existsSync(join(skillsDir, 'specdev-rewind.md')), 'specdev-rewind.md installed')
assert(existsSync(join(skillsDir, 'specdev-brainstorm.md')), 'specdev-brainstorm.md installed')
assert(existsSync(join(skillsDir, 'specdev-continue.md')), 'specdev-continue.md installed')
assert(existsSync(join(skillsDir, 'specdev-review.md')), 'specdev-review.md installed')
const remindSkill = readFileSync(join(skillsDir, 'specdev-remind.md'), 'utf-8')
assert(remindSkill.includes('specdev remind'), 'remind skill references specdev remind command')
assert(remindSkill.includes('Using specdev:'), 'remind skill includes prefix instruction')

// ---- Test generic platform does NOT install skills ----
console.log('\ngeneric skips skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'generic platform does not create .claude/skills/')
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-init-platform.js`
Expected: FAIL — skills not installed yet

**Step 3: Write minimal implementation**

In `src/commands/init.js`, add the skill templates after the `ADAPTERS` constant (after line 25):

```javascript
const SKILL_FILES = {
  'specdev-remind.md': `---
name: specdev-remind
description: Re-anchor to the specdev workflow with a phase-aware context refresh
---

Run \`specdev remind\` and present the output to the user. This shows your current assignment, phase, and the rules that apply right now.

After reading the output, continue your work following those rules. Announce every subtask with "Using specdev: <action>".
`,
  'specdev-rewind.md': `---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read \`.specdev/_main.md\` completely
2. Run \`specdev remind\` to confirm your current assignment and phase
3. Resume work following the workflow rules

Announce every subtask with "Using specdev: <action>".
`,
  'specdev-brainstorm.md': `---
name: specdev-brainstorm
description: Start the specdev brainstorm phase for a new feature or change
---

Read \`.specdev/skills/core/brainstorming/SKILL.md\` and follow it exactly.

Start by reading \`.specdev/_main.md\` for workflow context, then begin
the interactive brainstorm process with the user.
`,
  'specdev-continue.md': `---
name: specdev-continue
description: Resume specdev work from where you left off
---

1. Run \`specdev remind\` to see current assignment state and phase
2. Check if \`.specdev/assignments/<current>/review/watching.json\` exists
   - If yes: a review agent is active. Use auto mode with polling.
   - If no: manual mode. Proceed without polling.
3. Read the skill for your current phase:
   - brainstorm → \`.specdev/skills/core/brainstorming/SKILL.md\`
   - breakdown → \`.specdev/skills/core/breakdown/SKILL.md\`
   - implementation → \`.specdev/skills/core/implementing/SKILL.md\`
4. Pick up from where the assignment state indicates

Announce every subtask with "Using specdev: <action>".
`,
  'specdev-review.md': `---
name: specdev-review
description: Start a specdev review agent session
---

You are the review agent. Read \`.specdev/skills/core/review-agent/SKILL.md\`
and follow it exactly.

Ask the user which mode to use:
- \`review <phase>\` — one-shot review of a specific phase
- \`autoreview <phases>\` — watch and review phases automatically
`,
}
```

Then add the skill installation logic inside `initCommand`, after the adapter creation block (after line 81, before the "SpecDev initialized successfully" log):

```javascript
    // Install skills for claude platform
    if (platform === 'claude') {
      const skillsDir = join(targetDir, '.claude', 'skills')
      if (!existsSync(skillsDir)) {
        mkdirSync(skillsDir, { recursive: true })
      }
      for (const [filename, content] of Object.entries(SKILL_FILES)) {
        writeFileSync(join(skillsDir, filename), content, 'utf-8')
      }
      console.log(`✅ Installed ${Object.keys(SKILL_FILES).length} skills to .claude/skills/`)
    }
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-init-platform.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/init.js tests/test-init-platform.js
git commit -m "feat: install specdev slash-command skills during init --platform=claude"
```

---

### Task 2: Update skills via `specdev update`

**Files:**
- Modify: `src/commands/init.js` (export SKILL_FILES)
- Modify: `src/utils/update.js:11-75`
- Modify: `src/commands/update.js:23-38,46-61`

**Step 1: Write the failing test**

Create `tests/test-update-skills.js`:

```javascript
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-update-skills-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    failures++
  } else {
    console.log(`  ✓ ${msg}`)
    passes++
  }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// ---- Setup: init with claude platform ----
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])

// ---- Test update overwrites skill files ----
console.log('\nupdate overwrites skills:')
const remindPath = join(TEST_DIR, '.claude', 'skills', 'specdev-remind.md')
writeFileSync(remindPath, '# tampered content\n')
let result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
const afterUpdate = readFileSync(remindPath, 'utf-8')
assert(afterUpdate.includes('specdev remind'), 'skill file restored after update')
assert(!afterUpdate.includes('tampered'), 'tampered content replaced')

// ---- Test update reports skill update ----
assert(result.stdout.includes('.claude/skills'), 'update output mentions skills')

// ---- Test update skips skills when .claude/skills does not exist ----
console.log('\nupdate skips when no .claude/skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])  // generic platform, no skills
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds without skills')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'does not create .claude/skills')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-update-skills.js`
Expected: FAIL — update doesn't touch skills yet

**Step 3: Write minimal implementation**

First, export `SKILL_FILES` from `init.js`. Change the `const` to `export const`:

In `src/commands/init.js`, change:
```javascript
const SKILL_FILES = {
```
to:
```javascript
export const SKILL_FILES = {
```

Then modify `src/utils/update.js`. Add import at top:

```javascript
import { existsSync, writeFileSync, mkdirSync } from 'fs'
```

Add at the end of `updateSpecdevSystem`, before `return updatedPaths` (line 71), add a `targetDir` parameter and skill update logic. Actually, cleaner approach: add a new exported function.

Add after the `isValidSpecdevInstallation` function (after line 101):

```javascript
/**
 * Updates skill files in .claude/skills/ if they exist
 * Auto-detects by checking for specdev-remind.md
 *
 * @param {string} targetDir - Project root directory
 * @param {Record<string, string>} skillFiles - Map of filename to content
 * @returns {number} Number of files updated, or 0 if skipped
 */
export function updateSkillFiles(targetDir, skillFiles) {
  const skillsDir = join(targetDir, '.claude', 'skills')
  const markerFile = join(skillsDir, 'specdev-remind.md')

  if (!existsSync(markerFile)) {
    return 0
  }

  for (const [filename, content] of Object.entries(skillFiles)) {
    writeFileSync(join(skillsDir, filename), content, 'utf-8')
  }

  return Object.keys(skillFiles).length
}
```

Then modify `src/commands/update.js` to call it. Add imports:

```javascript
import { updateSpecdevSystem, isValidSpecdevInstallation, updateSkillFiles } from '../utils/update.js'
import { SKILL_FILES } from './init.js'
```

Add after the `updatedPaths.forEach` block (after line 53), before the "Preserved" output:

```javascript
    // Update skill files if installed
    const skillCount = updateSkillFiles(targetDir, SKILL_FILES)
    if (skillCount > 0) {
      console.log(`   ✓ .claude/skills/ (${skillCount} skill files)`)
    }
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-update-skills.js`
Expected: PASS

Also run the full test suite as regression:
Run: `npm test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/commands/init.js src/utils/update.js src/commands/update.js tests/test-update-skills.js
git commit -m "feat: specdev update refreshes skill files with auto-detection"
```

---

### Task 3: Wire test into CI pipeline

**Files:**
- Modify: `package.json`

**Step 1: Add the test scripts**

In `package.json` scripts, add after `"test:check"`:
```json
"test:remind": "node ./tests/test-remind.js",
"test:update-skills": "node ./tests/test-update-skills.js",
```

Update the `"test"` script to include both new tests. Insert them before `test:cleanup`:
```
... && npm run test:check && npm run test:remind && npm run test:update-skills && npm run test:cleanup
```

Also update the `"test:cleanup"` script to include the new test output directories:
```
rm -rf ./test-output ./test-manual ./test-scan-output ./test-work-output ./test-check-output ./tests/test-skills-output ./tests/test-orientation-output ./tests/test-tdd-output ./tests/test-implementing-output ./tests/test-review-agent-output ./tests/test-parallel-worktrees-output ./tests/test-parallel-worktrees-output-worktrees ./tests/test-init-platform-output ./tests/test-remind-output ./tests/test-update-skills-output
```

**Step 2: Run the full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add remind and update-skills tests to CI pipeline"
```

---

## Summary

| Task | Type | What |
|------|------|------|
| 1 | Feature | Install 5 skill files during `init --platform=claude` |
| 2 | Feature | Auto-detect and update skill files during `specdev update` |
| 3 | CI | Wire new tests into pipeline |
