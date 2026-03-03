# Reviewloop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename autoloop → reviewloop everywhere, add `specdev reviewloop [phase]` CLI command, and clean up old autoloop on update.

**Architecture:** Rename the tool skill directory and all references, add a new CLI command following the same signal-to-agent pattern as `specdev review`, and add `autoloop` to the update.js cleanup list so `specdev update` removes the old directory.

**Tech Stack:** Node.js, bash, specdev CLI framework

---

### Task 1: Rename autoloop directory and files to reviewloop

**Files:**
- Rename: `templates/.specdev/skills/tools/autoloop/` → `templates/.specdev/skills/tools/reviewloop/`
- Rename: `templates/.specdev/skills/tools/reviewloop/scripts/autoloop.sh` → `reviewloop.sh`
- Modify: `templates/.specdev/skills/tools/reviewloop/SKILL.md`
- Modify: `templates/.specdev/skills/tools/reviewloop/scripts/reviewloop.sh`
- Modify: `templates/.specdev/skills/tools/reviewloop/reviewers/codex-with-context.json`

**Step 1: Rename the directory**

```bash
git mv templates/.specdev/skills/tools/autoloop templates/.specdev/skills/tools/reviewloop
```

**Step 2: Rename the script**

```bash
git mv templates/.specdev/skills/tools/reviewloop/scripts/autoloop.sh templates/.specdev/skills/tools/reviewloop/scripts/reviewloop.sh
```

**Step 3: Update SKILL.md**

Replace all "autoloop" references with "reviewloop":
- Frontmatter `name: autoloop` → `name: reviewloop`
- Title `# Autoloop` → `# Reviewloop`
- All body text: "autoloop" → "reviewloop"
- Script path reference: `autoloop.sh` → `reviewloop.sh`

**Step 4: Update reviewloop.sh**

Replace all env var references:
- `AUTOLOOP_REVIEWERS_DIR` → `REVIEWLOOP_REVIEWERS_DIR`
- `AUTOLOOP_PROMPT` → `REVIEWLOOP_PROMPT`
- `AUTOLOOP_CONTEXT` → `REVIEWLOOP_CONTEXT`
- `AUTOLOOP_CONTEXT_FILE` → `REVIEWLOOP_CONTEXT_FILE`
- `AUTOLOOP_FILES` → `REVIEWLOOP_FILES`
- `AUTOLOOP_ROUND` → `REVIEWLOOP_ROUND`
- `AUTOLOOP_MAX_ROUNDS` → `REVIEWLOOP_MAX_ROUNDS`
- Internal var name `__AUTOLOOP_CFG` → `__REVIEWLOOP_CFG`
- Comments: "autoloop.sh" → "reviewloop.sh"
- Usage comment: update script name

**Step 5: Update codex-with-context.json**

Change `"$AUTOLOOP_PROMPT"` → `"$REVIEWLOOP_PROMPT"` in the command field.

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: rename autoloop to reviewloop"
```

---

### Task 2: Update source references (update.js, brainstorming SKILL.md)

**Files:**
- Modify: `src/utils/update.js:5` — `OFFICIAL_TOOL_SKILLS`
- Modify: `src/utils/update.js:29-40` — add `autoloop` to removePaths cleanup
- Modify: `templates/.specdev/skills/core/brainstorming/SKILL.md:97,112-113` — autoloop → reviewloop

**Step 1: Update OFFICIAL_TOOL_SKILLS**

In `src/utils/update.js`, change:
```javascript
const OFFICIAL_TOOL_SKILLS = ['autoloop']
```
to:
```javascript
const OFFICIAL_TOOL_SKILLS = ['reviewloop']
```

**Step 2: Add autoloop to cleanup list**

In `src/utils/update.js`, add to the `removePaths` array:
```javascript
'skills/tools/autoloop',
```

This ensures `specdev update` deletes old autoloop/ before installing reviewloop/.

**Step 3: Update brainstorming SKILL.md**

Replace "autoloop" with "reviewloop" in the two references:
- Line 97: `Request an automated external review via the **reviewloop** tool skill`
- Line 113: `**Reviewloop:** User may request automated external review (e.g., Codex) via the reviewloop tool skill before approving`

**Step 4: Commit**

```bash
git add src/utils/update.js templates/.specdev/skills/core/brainstorming/SKILL.md
git commit -m "refactor: update autoloop references to reviewloop in source"
```

---

### Task 3: Rename and update tests

**Files:**
- Rename: `tests/test-autoloop-script.js` → `tests/test-reviewloop-script.js`
- Rename: `tests/test-autoloop-install.js` → `tests/test-reviewloop-install.js`
- Modify: `tests/test-update-skills.js:75-81`
- Modify: `package.json` — test script names and `npm test` command

**Step 1: Rename test files**

```bash
git mv tests/test-autoloop-script.js tests/test-reviewloop-script.js
git mv tests/test-autoloop-install.js tests/test-reviewloop-install.js
```

**Step 2: Update test-reviewloop-script.js**

Replace all references:
- Script path: `'autoloop', 'scripts', 'autoloop.sh'` → `'reviewloop', 'scripts', 'reviewloop.sh'`
- Test dir: `test-autoloop-script-output` → `test-reviewloop-script-output`
- Env var: `AUTOLOOP_REVIEWERS_DIR` → `REVIEWLOOP_REVIEWERS_DIR`
- Console labels: `autoloop.sh` → `reviewloop.sh`

**Step 3: Update test-reviewloop-install.js**

Replace all references:
- Test dir: `test-autoloop-install-output` → `test-reviewloop-install-output`
- Skill paths: `'autoloop'` → `'reviewloop'`
- Assertions: `'name: autoloop'` → `'name: reviewloop'`
- Console labels: `autoloop` → `reviewloop`

**Step 4: Update test-update-skills.js**

Replace references on lines 75-81:
- `autoloopSkillPath` → `reviewloopSkillPath`
- Path segments: `'autoloop'` → `'reviewloop'`
- Assertions: `'name: autoloop'` → `'name: reviewloop'`, `'tampered autoloop'` → `'tampered reviewloop'`
- Messages: update to say "reviewloop"

**Step 5: Update package.json**

Replace test script names:
- `"test:autoloop-script"` → `"test:reviewloop-script"`
- `"test:autoloop-install"` → `"test:reviewloop-install"`
- Update file paths in the values accordingly
- Update the `"test"` script to reference the new names

**Step 6: Run tests**

```bash
npm test
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add -A && git commit -m "test: rename autoloop tests to reviewloop"
```

---

### Task 4: Add `specdev reviewloop [phase]` CLI command

**Files:**
- Create: `src/commands/reviewloop.js`
- Modify: `src/commands/dispatch.js` — register command
- Modify: `src/commands/help.js` — add to workflow section

**Step 1: Create reviewloop.js**

Create `src/commands/reviewloop.js` following the pattern of `review.js`:

```javascript
import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printLines, printSection } from '../utils/output.js'

/**
 * specdev reviewloop <phase> — Automated external review loop (signal to agent)
 */
export async function reviewloopCommand(positionalArgs = [], flags = {}) {
  const VALID_PHASES = ['brainstorm', 'implementation']
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev reviewloop <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown reviewloop phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  blankLine()

  // Check artifacts exist
  if (phase === 'brainstorm') {
    const designPath = join(assignmentPath, 'brainstorm', 'design.md')
    if (await fse.pathExists(designPath)) {
      printSection('Artifact found:')
      console.log(`   ${name}/brainstorm/design.md`)
    } else {
      console.error('❌ brainstorm/design.md not found')
      console.log('   Complete brainstorming before running reviewloop.')
      process.exitCode = 1
      return
    }
  } else if (phase === 'implementation') {
    const planPath = join(assignmentPath, 'breakdown', 'plan.md')
    if (await fse.pathExists(planPath)) {
      printSection('Artifact found:')
      console.log(`   ${name}/breakdown/plan.md`)
    } else {
      printSection('No plan artifact found — reviewing code changes only.')
    }
  }

  // Scan for available reviewers
  const specdevDir = join(assignmentPath, '..', '..', '.specdev')
  const reviewersDir = join(specdevDir, 'skills', 'tools', 'reviewloop', 'reviewers')
  const reviewers = []
  if (await fse.pathExists(reviewersDir)) {
    const files = await fse.readdir(reviewersDir)
    for (const f of files) {
      if (f.endsWith('.json')) reviewers.push(f.replace('.json', ''))
    }
  }

  blankLine()
  if (reviewers.length > 0) {
    printSection('Available reviewers:')
    for (const r of reviewers) {
      console.log(`   - ${r}`)
    }
  } else {
    console.error('❌ No reviewer configs found')
    console.log(`   Add reviewer JSON configs to .specdev/skills/tools/reviewloop/reviewers/`)
    process.exitCode = 1
    return
  }

  blankLine()
  printSection('To run automated review, execute:')
  printLines([
    '   bash .specdev/skills/tools/reviewloop/scripts/reviewloop.sh \\',
    '     --reviewer <name> --round 1 --scope diff',
  ])

  blankLine()
  printSection('The agent should:')
  printLines([
    '  1. Pick a reviewer and scope',
    '  2. Run the script',
    '  3. Fix issues from findings',
    '  4. Re-run until pass or max rounds',
  ])
  blankLine()
}
```

**Step 2: Register in dispatch.js**

Add import:
```javascript
import { reviewloopCommand } from './reviewloop.js'
```

Add to `commandHandlers`:
```javascript
reviewloop: ({ positionalArgs, flags }) => reviewloopCommand(positionalArgs, flags),
```

**Step 3: Update help.js**

Add after the existing review section in the COMMANDS list:
```javascript
'  reviewloop <phase>  Automated external review loop (brainstorm | implementation)',
```

Add after the review workflow section:
```javascript
'  # Optional: automated external review loop',
'  specdev reviewloop brainstorm     # Automated review via external CLI',
```

**Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/commands/reviewloop.js src/commands/dispatch.js src/commands/help.js
git commit -m "feat: add specdev reviewloop CLI command"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

**Step 2: Verify no stale autoloop references**

```bash
grep -r "autoloop" src/ templates/ tests/ --include="*.js" --include="*.sh" --include="*.md" --include="*.json" | grep -v "node_modules" | grep -v "docs/plans"
```

Expected: no matches (docs/plans are excluded since those are historical).

**Step 3: Test CLI commands manually**

```bash
# Init a test project
node bin/specdev.js init --target=/tmp/test-reviewloop
# Check reviewloop skill exists
ls /tmp/test-reviewloop/.specdev/skills/tools/reviewloop/
# Check help shows reviewloop
node bin/specdev.js help | grep reviewloop
# Cleanup
rm -rf /tmp/test-reviewloop
```
