# Specdev Discussion Skill Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Rename `specdev discuss` to `specdev discussion` and create a corresponding agent skill that orchestrates brainstorming discussions.

**Architecture:** Pure rename of CLI command (discuss → discussion) in dispatch, help, and all user-facing strings. New `.claude/skills/specdev-discussion/SKILL.md` mirrors the `specdev-assignment` skill pattern. New `discussion_progress.md` template added to project_notes.

**Tech Stack:** Node.js CLI, fs-extra, spawnSync-based test harness

---

### Task 1: Rename CLI command from `discuss` to `discussion` in dispatch and source file
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/commands/dispatch.js`, rename `src/commands/discuss.js` → `src/commands/discussion.js`, modify `tests/test-discuss.js`

**Step 1: Update test to use `discussion` command name**
In `tests/test-discuss.js`, change all `'discuss'` command args to `'discussion'`:
```js
// Line 23: change 'discuss' to 'discussion'
let r = runSpecdev(['discussion', 'auth ideas', `--target=${TEST_DIR}`, '--json'])
// Line 24: update assertion message
ok = assertTest(r.status === 0, 'discussion exits 0', r.stderr)
// Line 27: update assertion message
ok = assertTest(existsSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm')), 'discussion creates folder with brainstorm subdir') && ok

// Line 30: change 'discuss' to 'discussion'
r = runSpecdev(['discussion', 'perf tuning', `--target=${TEST_DIR}`, '--json'])
// Line 31: update assertion message
ok = assertTest(r.status === 0, 'second discussion exits 0', r.stderr) && ok
// Line 33: update assertion message
ok = assertTest(output2.id === 'D0002', 'second discussion returns D0002') && ok

// Line 36: change 'discuss' to 'discussion'
r = runSpecdev(['discussion', '--list', `--target=${TEST_DIR}`])
// Line 37-39: update assertion messages
ok = assertTest(r.status === 0, 'discussion --list exits 0', r.stderr) && ok
ok = assertTest(r.stdout.includes('D0001_auth-ideas'), 'discussion --list shows D0001') && ok
ok = assertTest(r.stdout.includes('D0002_perf-tuning'), 'discussion --list shows D0002') && ok

// Line 42: change 'discuss' to 'discussion'
r = runSpecdev(['discussion', `--target=${TEST_DIR}`])
// Line 43: update assertion message
ok = assertTest(r.status !== 0, 'discussion with no args exits non-zero') && ok
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-discuss.js`
Expected: FAIL — `discussion` is not a recognized command yet

**Step 3: Rename source file and update dispatch**
- `git mv src/commands/discuss.js src/commands/discussion.js`
- In `src/commands/dispatch.js`:
  - Change import: `import { discussCommand } from './discuss.js'` → `import { discussCommand } from './discussion.js'`
  - Change route key: `discuss:` → `discussion:`
- In `src/commands/discussion.js` (renamed file), update usage strings:
  - Line 42: `'   Usage: specdev discuss "explore auth approaches"'` → `'   Usage: specdev discussion "explore auth approaches"'`
  - Line 43: `'   Usage: specdev discuss --list'` → `'   Usage: specdev discussion --list'`

**Step 4: Run test to verify it passes**
Run: `node tests/test-discuss.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/discussion.js src/commands/dispatch.js tests/test-discuss.js
git rm src/commands/discuss.js
git commit -m "refactor: rename specdev discuss to specdev discussion"
```

---

### Task 2: Update help text and error messages in other commands
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/commands/help.js`, `src/commands/review.js`, `src/commands/reviewloop.js`, `src/commands/checkpoint.js`

**Step 1: Write the failing test**
Add a test to `tests/test-discuss.js` that verifies help output says `discussion` not `discuss`:
```js
// After existing tests, before cleanup()
// Test 5: help output references 'discussion' not 'discuss'
r = runSpecdev(['help'])
ok = assertTest(r.stdout.includes('discussion <desc>'), 'help shows discussion command') && ok
ok = assertTest(!r.stdout.includes('discuss <desc>'), 'help does not show old discuss command') && ok
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-discuss.js`
Expected: FAIL — help still says `discuss <desc>`

**Step 3: Write minimal implementation**
In `src/commands/help.js`:
- Line 22: `'  discuss <desc>      Start a parallel brainstorming discussion'` → `'  discussion <desc>   Start a parallel brainstorming discussion'`
- Line 43: `'  --discussion=<id> Target a discussion instead of an assignment'` (unchanged)
- Line 54: `'  specdev discuss "Explore auth"    # Start a parallel brainstorming discussion'` → `'  specdev discussion "Explore auth"  # Start a parallel brainstorming discussion'`

In `src/commands/review.js` line 49:
- `'--discussion flag is required. Use specdev discuss --list to see available discussions.'` → `'--discussion flag is required. Use specdev discussion --list to see available discussions.'`

In `src/commands/reviewloop.js` line 44:
- `'--discussion flag is required. Use specdev discuss --list to see available discussions.'` → `'--discussion flag is required. Use specdev discussion --list to see available discussions.'`

In `src/commands/checkpoint.js` line 30:
- `'--discussion flag is required. Use specdev discuss --list to see available discussions.'` → `'--discussion flag is required. Use specdev discussion --list to see available discussions.'`

**Step 4: Run test to verify it passes**
Run: `node tests/test-discuss.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/help.js src/commands/review.js src/commands/reviewloop.js src/commands/checkpoint.js tests/test-discuss.js
git commit -m "refactor: update help and error messages from discuss to discussion"
```

---

### Task 3: Update documentation files (.specdev and templates)
**Mode:** lightweight
**Files:** Modify `.specdev/_main.md`, `.specdev/_index.md`, `.specdev/_guides/workflow.md`, `templates/.specdev/_main.md`, `templates/.specdev/_index.md`, `templates/.specdev/_guides/workflow.md`

**Step 1: Update all doc references**
Exact string replacements in each file:

- `.specdev/_main.md` line 19: `specdev discuss "<description>"` → `specdev discussion "<description>"`
- `.specdev/_guides/workflow.md` line 14: `specdev discuss "<description>"` → `specdev discussion "<description>"`
- `.specdev/_index.md` line 77: `After a \`specdev discuss\` exploration` → `After a \`specdev discussion\` exploration`
- `.specdev/_index.md` line 79: `\`specdev discuss "<desc>"\`` → `\`specdev discussion "<desc>"\``
- `.specdev/_index.md` line 79: `(no full assignment)` row — command column changes from `specdev discuss` to `specdev discussion`
- `templates/.specdev/_main.md` — same change as `.specdev/_main.md` (line with `specdev discuss`)
- `templates/.specdev/_guides/workflow.md` — same change as `.specdev/_guides/workflow.md` (line with `specdev discuss`)
- `templates/.specdev/_index.md` — same changes as `.specdev/_index.md` (lines 77 and 79 equivalents)

**Step 2: Verify with grep**
Run: `grep -r "specdev discuss[^i]" src/ templates/ .specdev/ --include="*.md" --include="*.js"`
Expected: Zero matches (all references should now be `specdev discussion`)

**Step 3: Commit**
```
git add .specdev/_main.md .specdev/_index.md .specdev/_guides/workflow.md templates/.specdev/_main.md templates/.specdev/_index.md templates/.specdev/_guides/workflow.md
git commit -m "docs: update all references from specdev discuss to specdev discussion"
```

---

### Task 4: Create `.claude/skills/specdev-discussion/SKILL.md`
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `.claude/skills/specdev-discussion/SKILL.md`, modify `tests/test-skills.js` (if it validates skill files)

**Step 1: Write the failing test**
Add to `tests/test-discuss.js`:
```js
// Test 6: skill file exists with correct frontmatter
const skillPath = join(process.cwd(), '.claude', 'skills', 'specdev-discussion', 'SKILL.md')
ok = assertTest(existsSync(skillPath), 'specdev-discussion skill file exists') && ok
const skillContent = readFileSync(skillPath, 'utf-8')
ok = assertTest(skillContent.includes('name: specdev-discussion'), 'skill has correct name frontmatter') && ok
ok = assertTest(skillContent.includes('specdev discussion'), 'skill references correct command name') && ok
```
Update line 1 import to: `import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'`

**Step 2: Run test to verify it fails**
Run: `node tests/test-discuss.js`
Expected: FAIL — skill file doesn't exist

**Step 3: Write minimal implementation**
Create `.claude/skills/specdev-discussion/SKILL.md`:
```markdown
---
name: specdev-discussion
description: Start a parallel brainstorming discussion
---

Run `specdev discussion "<description>"` to reserve a discussion ID.

Read the output to get the reserved ID and folder path, then:
1. Follow `.specdev/skills/core/brainstorming/SKILL.md` exactly, writing artifacts to the discussion's brainstorm/ folder
2. After creating the discussion, add a row to `.specdev/project_notes/discussion_progress.md`

Announce every subtask with "Specdev: <action>".
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-discuss.js`
Expected: PASS

**Step 5: Commit**
```
git add .claude/skills/specdev-discussion/SKILL.md tests/test-discuss.js
git commit -m "feat: add specdev-discussion agent skill"
```

---

### Task 5: Add `discussion_progress.md` to project_notes and templates
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `.specdev/project_notes/discussion_progress.md`, create `templates/.specdev/project_notes/discussion_progress.md`, modify `tests/test-discuss.js`

**Step 1: Write the failing test**
Add to `tests/test-discuss.js`:
```js
// Test 7: discussion_progress.md template exists
const templatePath = join(process.cwd(), 'templates', '.specdev', 'project_notes', 'discussion_progress.md')
ok = assertTest(existsSync(templatePath), 'discussion_progress.md template exists') && ok
const templateContent = readFileSync(templatePath, 'utf-8')
ok = assertTest(templateContent.includes('Discussion Progress'), 'template has correct header') && ok
ok = assertTest(templateContent.includes('Promoted To'), 'template has Promoted To column') && ok
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-discuss.js`
Expected: FAIL — template file doesn't exist

**Step 3: Write minimal implementation**
Create both `.specdev/project_notes/discussion_progress.md` and `templates/.specdev/project_notes/discussion_progress.md` with identical content:
```markdown
# Discussion Progress

Below is a list of discussions and their status.

## Format

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|
| ##### | Short description | Status | YYYY-MM-DD | Assignment ID | Optional notes |

**Status Values:**
- **Active**: Brainstorming in progress
- **Complete**: Brainstorm finished, not yet promoted
- **Promoted**: Converted to an assignment
- **Abandoned**: Discussion dropped

---

## Discussions

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|

---

## Instructions

1. When creating a new discussion, add a row with the discussion ID (D0001 format)
2. Update status as the discussion progresses
3. When promoted, record the assignment ID in the "Promoted To" column
4. Use Notes column for context or abandonment reasons
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-discuss.js`
Expected: PASS

**Step 5: Commit**
```
git add .specdev/project_notes/discussion_progress.md templates/.specdev/project_notes/discussion_progress.md tests/test-discuss.js
git commit -m "feat: add discussion_progress.md to project_notes and templates"
```

---

### Task 6: Final verification — full test suite and grep check
**Mode:** full
**Skills:** test-driven-development, verification-before-completion
**Files:** All modified files

**Step 1: Run full test suite**
Ask the user for approval before running tests (per CLAUDE.md).
Run: `npm test`
Expected: All tests pass

**Step 2: Verify no stale references remain**
Run: `grep -rn "specdev discuss[^i]" src/ templates/ .specdev/ tests/ --include="*.md" --include="*.js" | grep -v node_modules | grep -v ".git/"`
Expected: Zero matches

**Step 3: Verify promotion path still works**
Run: `node tests/test-assignment.js`
Expected: PASS (the `--discussion` flag in assignment command still works)

**Step 4: Commit (if any fixes needed)**
```
git add -A
git commit -m "test: verify full suite passes after discuss-to-discussion rename"
```
