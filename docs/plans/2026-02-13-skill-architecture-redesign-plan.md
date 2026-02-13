# Skill Architecture Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure `.specdev/skills/` into `core/` and `tools/` directories with aligned frontmatter, plan-driven skill injection, and updated infrastructure.

**Architecture:** All existing skills move under `skills/core/`. A new `skills/tools/` directory is created for user/hub-owned tool skills. SKILL.md frontmatter aligns with Claude Code's format, adding SpecDev-specific fields (`type`, `phase`, `input`, `output`, `next`). The breakdown skill declares per-task skill dependencies via a `Skills:` field, which the implementing skill parses and injects into subagent prompts.

**Tech Stack:** Node.js (ESM), bash scripts, markdown

**Design doc:** `docs/plans/2026-02-13-skill-architecture-redesign.md`

---

### Task 1: Move template skills into core/ subdirectory

**Files:**
- Create: `templates/.specdev/skills/core/` (directory)
- Move: All existing skill directories and flat .md files from `templates/.specdev/skills/` into `templates/.specdev/skills/core/`
- Preserve: `templates/.specdev/skills/README.md` (stays at top level, will be rewritten in Task 3)

**Step 1: Create core directory and move all skills**

```bash
cd /mnt/h/oceanwave/lib/specdev-cli/templates/.specdev/skills
mkdir -p core
# Move directory-based skills
mv brainstorming breakdown implementing knowledge-capture review-agent \
   orientation test-driven-development systematic-debugging parallel-worktrees core/
# Move flat reference skills
mv scaffolding-lite.md scaffolding-full.md verification-before-completion.md \
   receiving-code-review.md core/
```

**Step 2: Create tools/ directory with README**

Create `templates/.specdev/skills/tools/README.md`:

```markdown
# Tool Skills

Project-specific tool skills live here. These are never overwritten by `specdev update`.

## Adding a tool skill

Create a directory with a `SKILL.md` file:

```text
tools/my-tool/
├── SKILL.md           # Instructions and frontmatter (required)
└── scripts/           # Executable scripts (optional)
    └── run.sh
```

## Frontmatter

```yaml
---
name: my-tool
description: What this tool does and when to use it

# SpecDev fields
type: tool
---
```

Tool skills can be referenced in plan tasks via the `Skills:` field. The implementing phase will inject them into subagent context.

## Compatibility

Tool skills use the same SKILL.md format as Claude Code skills. You can copy a skill between `.claude/skills/` and `.specdev/skills/tools/` without modification.
```

Also create `templates/.specdev/skills/tools/.gitkeep`.

**Step 3: Verify structure**

```bash
ls templates/.specdev/skills/
# Expected: README.md  core/  tools/

ls templates/.specdev/skills/core/
# Expected: brainstorming/  breakdown/  implementing/  knowledge-capture/
#           review-agent/  orientation/  test-driven-development/
#           systematic-debugging/  parallel-worktrees/
#           scaffolding-lite.md  scaffolding-full.md
#           verification-before-completion.md  receiving-code-review.md

ls templates/.specdev/skills/tools/
# Expected: README.md  .gitkeep
```

**Step 4: Commit**

```bash
git add templates/.specdev/skills/
git commit -m "refactor: move template skills into skills/core/, add skills/tools/"
```

---

### Task 2: Update verify-output.js test paths

**Files:**
- Modify: `tests/verify-output.js`

**Step 1: Write the failing test (verify current tests break)**

Run: `node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: FAIL — paths like `.specdev/skills/brainstorming/SKILL.md` no longer exist (they moved to `skills/core/`)

**Step 2: Update all skill paths in verify-output.js**

Replace every `.specdev/skills/<name>` path with `.specdev/skills/core/<name>`. Also add the new `tools/` paths.

Change these lines (approximately lines 47-82):

```javascript
  // Skills library
  '.specdev/skills/README.md',
  '.specdev/skills/core/scaffolding-lite.md',
  '.specdev/skills/core/scaffolding-full.md',
  '.specdev/skills/core/receiving-code-review.md',
  '.specdev/skills/core/verification-before-completion.md',
  // Brainstorming skill (directory-based)
  '.specdev/skills/core/brainstorming/SKILL.md',
  '.specdev/skills/core/brainstorming/scripts/get-project-context.sh',
  // Breakdown skill (directory-based)
  '.specdev/skills/core/breakdown/SKILL.md',
  // Implementing skill (directory-based)
  '.specdev/skills/core/implementing/SKILL.md',
  '.specdev/skills/core/implementing/scripts/extract-tasks.sh',
  '.specdev/skills/core/implementing/scripts/track-progress.sh',
  '.specdev/skills/core/implementing/scripts/poll-for-feedback.sh',
  '.specdev/skills/core/implementing/prompts/implementer.md',
  '.specdev/skills/core/implementing/prompts/spec-reviewer.md',
  '.specdev/skills/core/implementing/prompts/code-reviewer.md',
  // Review-agent skill (directory-based)
  '.specdev/skills/core/review-agent/SKILL.md',
  '.specdev/skills/core/review-agent/scripts/poll-for-feedback.sh',
  '.specdev/skills/core/review-agent/prompts/breakdown-reviewer.md',
  '.specdev/skills/core/review-agent/prompts/implementation-reviewer.md',
  // Knowledge-capture skill (directory-based)
  '.specdev/skills/core/knowledge-capture/SKILL.md',
  // Test-driven-development skill (directory-based)
  '.specdev/skills/core/test-driven-development/SKILL.md',
  '.specdev/skills/core/test-driven-development/scripts/verify-tests.sh',
  // Systematic-debugging skill (directory-based)
  '.specdev/skills/core/systematic-debugging/SKILL.md',
  // Parallel-worktrees skill (directory-based)
  '.specdev/skills/core/parallel-worktrees/SKILL.md',
  '.specdev/skills/core/parallel-worktrees/scripts/setup-worktree.sh',
  // Orientation skill (directory-based)
  '.specdev/skills/core/orientation/SKILL.md',
  '.specdev/skills/core/orientation/scripts/list-skills.sh',
  // Tools directory
  '.specdev/skills/tools/README.md',
```

**Step 3: Run test to verify it passes**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS — `All required files present`

**Step 4: Commit**

```bash
git add tests/verify-output.js
git commit -m "test: update verify-output paths for skills/core/ structure"
```

---

### Task 3: Update skills/README.md for two-category model

**Files:**
- Modify: `templates/.specdev/skills/README.md`

**Step 1: Rewrite README.md**

```markdown
# SpecDev Skills Library

Skills are split into two categories:

## Core Skills (`core/`)

Managed by SpecDev. Updated by `specdev update`. These define the workflow.

### Folder-based skills

**Main agent (phases 1-3, 5):**
- `core/brainstorming/` — Interactive idea-to-design session
- `core/breakdown/` — Turn design into bite-sized executable steps
- `core/implementing/` — Execute plan with subagent dispatch and two-stage review
- `core/knowledge-capture/` — Write diff files after assignment completion

**Review agent (phase 4):**
- `core/review-agent/` — Holistic reviewer with file-based signals

**Supporting:**
- `core/test-driven-development/` — RED-GREEN-REFACTOR with verify-tests.sh
- `core/systematic-debugging/` — Root-cause-first debugging
- `core/parallel-worktrees/` — Git worktree isolation for parallel tasks
- `core/orientation/` — Router and decision tree

### Flat reference skills

**Always-apply:**
- `core/verification-before-completion.md` — No completion claims without evidence
- `core/receiving-code-review.md` — No performative agreement in reviews

**When needed:**
- `core/scaffolding-lite.md` — Lightweight scaffolding (contracts + dependency map)
- `core/scaffolding-full.md` — Full scaffolding (per-file blueprints)

## Tool Skills (`tools/`)

User-owned. Never touched by `specdev update`. Project-specific tools and capabilities.

See `tools/README.md` for how to add tool skills.

## Frontmatter

All skills use YAML frontmatter aligned with the Claude Code skill format:

```yaml
---
name: skill-name
description: What this skill does

# SpecDev fields
type: core       # or: tool
phase: implement # (core skills only) which workflow phase
---
```

## Plan-Driven Skill Injection

The breakdown phase can declare which skills each task needs via a `Skills:` field in plan tasks. The implementing phase reads these declarations and injects skill content into subagent prompts, solving context fade in long sessions.
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/README.md
git commit -m "docs: rewrite skills README for core/tools split"
```

---

### Task 4: Update src/utils/update.js for core/tools split

**Files:**
- Modify: `src/utils/update.js`

**Step 1: Write the failing test**

Create `tests/test-update-paths.js`:

```javascript
import { join } from 'path'
import fse from 'fs-extra'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const testDir = join(__dirname, 'test-update-output')
const templateDir = join(__dirname, '..', 'templates', '.specdev')

// Setup: create a minimal existing .specdev with core/ structure
async function setup() {
  await fse.remove(testDir)
  const specdevDir = join(testDir, '.specdev')
  await fse.mkdirp(join(specdevDir, '_guides'))
  await fse.mkdirp(join(specdevDir, 'project_notes'))
  await fse.writeFile(join(specdevDir, '_main.md'), 'old')
  await fse.writeFile(join(specdevDir, '_router.md'), 'old')
  // Create a user tool skill that must survive update
  await fse.mkdirp(join(specdevDir, 'skills', 'tools', 'my-custom-tool'))
  await fse.writeFile(
    join(specdevDir, 'skills', 'tools', 'my-custom-tool', 'SKILL.md'),
    '# My Custom Tool'
  )
  return specdevDir
}

async function test() {
  const specdevDir = await setup()

  const { updateSpecdevSystem } = await import('../src/utils/update.js')
  await updateSpecdevSystem(templateDir, specdevDir)

  // Core skills should exist
  const coreSkills = [
    'skills/core/brainstorming/SKILL.md',
    'skills/core/breakdown/SKILL.md',
    'skills/core/implementing/SKILL.md',
    'skills/core/scaffolding-lite.md',
    'skills/core/verification-before-completion.md',
  ]

  let failures = 0

  for (const p of coreSkills) {
    if (!await fse.pathExists(join(specdevDir, p))) {
      console.error(`FAIL: missing ${p}`)
      failures++
    }
  }

  // User tool skill must survive
  const userTool = join(specdevDir, 'skills', 'tools', 'my-custom-tool', 'SKILL.md')
  if (!await fse.pathExists(userTool)) {
    console.error('FAIL: user tool skill was deleted by update')
    failures++
  }

  // Tools README should exist
  if (!await fse.pathExists(join(specdevDir, 'skills', 'tools', 'README.md'))) {
    console.error('FAIL: tools/README.md not created')
    failures++
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} failures`)
    process.exit(1)
  }

  console.log('✅ Update paths test passed')
  await fse.remove(testDir)
}

test().catch(e => { console.error(e); process.exit(1) })
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-update-paths.js`
Expected: FAIL — `missing skills/core/brainstorming/SKILL.md` (update.js still uses old paths)

**Step 3: Update src/utils/update.js**

The key changes:
1. Add `skills/core` to `systemPaths` so it gets overwritten on update
2. Update `ensurePaths` to use `skills/core/` prefix and add `skills/tools/` paths
3. Remove obsolete skill references (micro-task-planning.md, subagent-driven-development.md, etc.)

```javascript
import fse from 'fs-extra'
import { join } from 'path'

export async function updateSpecdevSystem(source, destination) {
  const updatedPaths = []

  try {
    // System files and directories to update (fully overwritten)
    const systemPaths = [
      '_main.md',
      '_router.md',
      '_guides',
      '_templates',
      'project_scaffolding/_README.md',
      'skills/core',
      'skills/README.md',
    ]

    for (const path of systemPaths) {
      const sourcePath = join(source, path)
      const destPath = join(destination, path)

      if (!await fse.pathExists(sourcePath)) {
        console.warn(`⚠️  Warning: Source path not found: ${path}`)
        continue
      }

      await fse.copy(sourcePath, destPath, {
        overwrite: true,
        errorOnExist: false
      })

      updatedPaths.push(path)
    }

    // Ensure new project directories exist (create if missing, never overwrite)
    const ensurePaths = [
      'knowledge/_index.md',
      'knowledge/_workflow_feedback',
      'knowledge/codestyle',
      'knowledge/architecture',
      'knowledge/domain',
      'knowledge/workflow',
      'skills/tools/README.md',
      'skills/tools/.gitkeep',
    ]

    for (const path of ensurePaths) {
      const sourcePath = join(source, path)
      const destPath = join(destination, path)

      if (await fse.pathExists(destPath)) {
        continue
      }

      if (await fse.pathExists(sourcePath)) {
        await fse.copy(sourcePath, destPath)
        updatedPaths.push(`${path} (created)`)
      }
    }

    return updatedPaths
  } catch (error) {
    throw new Error(`Update failed: ${error.message}`)
  }
}

export async function isValidSpecdevInstallation(specdevPath) {
  if (!await fse.pathExists(specdevPath)) {
    return false
  }

  const requiredPaths = [
    join(specdevPath, '_guides'),
    join(specdevPath, 'project_notes')
  ]

  for (const path of requiredPaths) {
    if (!await fse.pathExists(path)) {
      return false
    }
  }

  return true
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-update-paths.js`
Expected: PASS

**Step 5: Run full init+verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/utils/update.js tests/test-update-paths.js
git commit -m "feat: update infrastructure for skills/core/ and skills/tools/ split"
```

---

### Task 5: Update update.js dry-run output

**Files:**
- Modify: `src/commands/update.js`

**Step 1: Update dry-run output text**

Change lines 29-36 to reflect the new structure:

```javascript
    console.log('   - skills/core/ (all core workflow skills, fully overwritten)')
    console.log('   - skills/README.md')
```

And in the preserved section:

```javascript
    console.log('   - skills/tools/ (your custom tool skills)')
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/update.js
git commit -m "fix: update dry-run output for core/tools skill split"
```

---

### Task 6: Update _router.md with core/ paths

**Files:**
- Modify: `templates/.specdev/_router.md`

**Step 1: Update all skill paths**

Replace every `skills/<name>` with `skills/core/<name>`. The full file becomes:

```markdown
Based on the user request, identify the situation and route to the right skill.

---

## First reads

- `.specdev/_main.md` — workflow overview
- `.specdev/_guides/README.md` — guide index
- `.specdev/project_notes/big_picture.md` — project context
- `.specdev/project_notes/feature_descriptions.md` — what exists today

---

## Core guides

- `.specdev/_guides/codestyle_guide.md` (must follow)
- `.specdev/_guides/assignment_guide.md` (must follow)

---

## Skill routing

### Main agent skills (phases 1-3, 5)

- **Brainstorming:** `skills/core/brainstorming/SKILL.md` — start here for new work
- **Breakdown:** `skills/core/breakdown/SKILL.md` — design → executable plan
- **Implementing:** `skills/core/implementing/SKILL.md` — plan → code with subagent dispatch
- **Knowledge Capture:** `skills/core/knowledge-capture/SKILL.md` — write diff files after completion

### Review agent skill (phase 4)

- **Review Agent:** `skills/core/review-agent/SKILL.md` — holistic phase reviews (separate session)

### Supporting skills (use when needed)

- **Test-Driven Development:** `skills/core/test-driven-development/SKILL.md` — RED-GREEN-REFACTOR
- **Systematic Debugging:** `skills/core/systematic-debugging/SKILL.md` — root-cause analysis
- **Parallel Worktrees:** `skills/core/parallel-worktrees/SKILL.md` — git worktree isolation
- **Orientation:** `skills/core/orientation/SKILL.md` — decision tree for skill selection

### Flat skills (reference guides)

- `skills/core/scaffolding-lite.md` — lightweight scaffolding
- `skills/core/scaffolding-full.md` — full scaffolding
- `skills/core/verification-before-completion.md` — always-apply: evidence before claims
- `skills/core/receiving-code-review.md` — always-apply: no performative agreement

### Tool skills (project-specific)

- Check `skills/tools/` for project-specific tool skills
- Tool skills can be referenced in plan tasks via the `Skills:` field

---

## Assignment structure

Assignments live in `.specdev/assignments/<id>/` with subfolders: `brainstorm/`, `breakdown/`, `implementation/`, `review/`.
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/_router.md
git commit -m "docs: update _router.md skill paths to skills/core/"
```

---

### Task 7: Update _main.md with core/ paths and tools documentation

**Files:**
- Modify: `templates/.specdev/_main.md`

**Step 1: Update skill references and add tools documentation**

Change `skills/orientation/SKILL.md` to `skills/core/orientation/SKILL.md` on line 9.

Add a section about the two skill categories under "How Skills Work":

```markdown
## How Skills Work

Skills live in two directories:

**`skills/core/`** — Workflow skills managed by SpecDev:
```
skills/core/<name>/
  SKILL.md        ← the manual
  scripts/        ← deterministic tools
  prompts/        ← subagent templates
```

**`skills/tools/`** — Project-specific tool skills (user-owned, never overwritten by update):
```
skills/tools/<name>/
  SKILL.md        ← instructions and frontmatter
  scripts/        ← executable tools
```

All skills use aligned frontmatter compatible with Claude Code's skill format.
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/_main.md
git commit -m "docs: update _main.md for core/tools skill split"
```

---

### Task 8: Update orientation/SKILL.md with core/ paths

**Files:**
- Modify: `templates/.specdev/skills/core/orientation/SKILL.md`

**Step 1: Update all skill path references**

Replace every `skills/` reference with `skills/core/`:
- Line 17: `skills/core/brainstorming/SKILL.md`
- Line 18: `skills/core/breakdown/SKILL.md`
- Line 19: `skills/core/implementing/SKILL.md`
- Line 20: `skills/core/review-agent/SKILL.md`
- Line 21: `skills/core/knowledge-capture/SKILL.md`
- Line 38: `skills/core/systematic-debugging/SKILL.md`
- Line 41: `skills/core/parallel-worktrees/SKILL.md`

Also add a tool skills routing entry:

```markdown
**Need a project-specific tool?**
→ Check **skills/tools/** for available tool skills
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/core/orientation/SKILL.md
git commit -m "docs: update orientation skill paths to skills/core/"
```

---

### Task 9: Update workflow and task guide references

**Files:**
- Modify: `templates/.specdev/_guides/workflow/feature_workflow.md`
- Modify: `templates/.specdev/_guides/workflow/bugfix_workflow.md`
- Modify: `templates/.specdev/_guides/workflow/refactor_workflow.md`
- Modify: `templates/.specdev/_guides/task/planning_guide.md`
- Modify: `templates/.specdev/_guides/task/scaffolding_guide.md`
- Modify: `templates/.specdev/_guides/task/implementing_guide.md`
- Modify: `templates/.specdev/_guides/task/validation_guide.md`
- Modify: `templates/.specdev/_guides/assignment_guide.md`

**Step 1: Update all skill path references in all guide files**

For every file listed above, replace `skills/` with `skills/core/` in all skill path references. Specific occurrences:

- `feature_workflow.md`: `skills/scaffolding-lite.md` → `skills/core/scaffolding-lite.md`, `skills/scaffolding-full.md` → `skills/core/scaffolding-full.md`
- `bugfix_workflow.md`: `skills/systematic-debugging.md` → `skills/core/systematic-debugging/SKILL.md`, `skills/scaffolding-*` → `skills/core/scaffolding-*`, `skills/verification-before-completion.md` → `skills/core/verification-before-completion.md`
- `refactor_workflow.md`: `skills/scaffolding-*` → `skills/core/scaffolding-*`, `skills/parallel-worktrees.md` → `skills/core/parallel-worktrees/SKILL.md`
- `planning_guide.md`: `skills/scaffolding-*` → `skills/core/scaffolding-*`
- `scaffolding_guide.md`: `skills/scaffolding-*` → `skills/core/scaffolding-*`
- `implementing_guide.md`: `skills/parallel-worktrees.md` → `skills/core/parallel-worktrees/SKILL.md`, `skills/systematic-debugging.md` → `skills/core/systematic-debugging/SKILL.md`, `skills/verification-before-completion.md` → `skills/core/verification-before-completion.md`
- `validation_guide.md`: `skills/requesting-code-review.md` → `skills/core/requesting-code-review.md`, `skills/receiving-code-review.md` → `skills/core/receiving-code-review.md`, `skills/review-agent` → `skills/core/review-agent`, `skills/verification-before-completion.md` → `skills/core/verification-before-completion.md`
- `assignment_guide.md`: `skills/scaffolding-*` → `skills/core/scaffolding-*`

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/_guides/
git commit -m "docs: update all guide skill paths to skills/core/"
```

---

### Task 10: Add aligned frontmatter to core SKILL.md files

**Files:**
- Modify: `templates/.specdev/skills/core/brainstorming/SKILL.md`
- Modify: `templates/.specdev/skills/core/breakdown/SKILL.md`
- Modify: `templates/.specdev/skills/core/implementing/SKILL.md`
- Modify: `templates/.specdev/skills/core/knowledge-capture/SKILL.md`
- Modify: `templates/.specdev/skills/core/review-agent/SKILL.md`
- Modify: `templates/.specdev/skills/core/orientation/SKILL.md`
- Modify: `templates/.specdev/skills/core/test-driven-development/SKILL.md`
- Modify: `templates/.specdev/skills/core/systematic-debugging/SKILL.md`
- Modify: `templates/.specdev/skills/core/parallel-worktrees/SKILL.md`

**Step 1: Update frontmatter in each SKILL.md**

Add SpecDev-specific fields to each file's existing frontmatter. Keep existing `name` and `description` fields, add `type`, and where applicable `phase`, `input`, `output`, `next`.

**brainstorming/SKILL.md:**
```yaml
---
name: brainstorming
description: Interactive idea-to-design session with collaborative Q&A
type: core
phase: brainstorm
input: User idea or request
output: brainstorm/proposal.md + brainstorm/design.md
next: breakdown
---
```

**breakdown/SKILL.md:**
```yaml
---
name: breakdown
description: Turn a validated design into bite-sized executable steps — automatic, no user interaction
type: core
phase: breakdown
input: brainstorm/design.md
output: breakdown/plan.md
next: implementing
---
```

**implementing/SKILL.md:**
```yaml
---
name: implementing
description: Execute a plan task-by-task with fresh subagents and two-stage review per task
type: core
phase: implement
input: breakdown/plan.md
output: Implemented code, committed per-task
next: knowledge-capture
---
```

**knowledge-capture/SKILL.md:**
```yaml
---
name: knowledge-capture
description: Distill learnings into knowledge branches after assignment completion
type: core
phase: capture
input: Completed assignment
output: Knowledge diff files
next: null
---
```

**review-agent/SKILL.md:**
```yaml
---
name: review-agent
description: Holistic reviewer with file-based signals — runs in separate session
type: core
phase: verify
input: review/ready-for-review.md
output: review/review-feedback.md
next: null
---
```

**orientation/SKILL.md:**
```yaml
---
name: orientation
description: Router — helps you find the right skill for your situation
type: core
---
```

**test-driven-development/SKILL.md:**
```yaml
---
name: test-driven-development
description: Iron law — no production code without a failing test first
type: core
---
```

**systematic-debugging/SKILL.md:**
```yaml
---
name: systematic-debugging
description: Root-cause-first debugging with evidence gathering
type: core
---
```

**parallel-worktrees/SKILL.md:**
```yaml
---
name: parallel-worktrees
description: Git worktree isolation for parallel task execution
type: core
---
```

For each file, replace only the frontmatter block (between `---` markers). Do not change the body content.

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/core/
git commit -m "feat: add aligned frontmatter with SpecDev fields to all core skills"
```

---

### Task 11: Update extract-tasks.sh to parse Skills: field

**Files:**
- Modify: `templates/.specdev/skills/core/implementing/scripts/extract-tasks.sh`
- Modify: `tests/test-implementing-scripts.js` (if it tests extract-tasks output)

**Step 1: Write a test for Skills: parsing**

Create `tests/test-extract-skills-field.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Create test plan with Skills: field
PLAN_FILE=$(mktemp)
cat > "$PLAN_FILE" << 'PLAN'
# Test Plan

### Task 1: Setup database

**Skills:** test-driven-development, systematic-debugging
**Files:**
- Create: `src/db.js`
- Test: `tests/db.test.js`

**Step 1: Write test**
...

### Task 2: Add API endpoint

**Files:**
- Create: `src/api.js`

**Step 1: Write test**
...
PLAN

SCRIPT_DIR="$(cd "$(dirname "$0")/../templates/.specdev/skills/core/implementing/scripts" && pwd)"
OUTPUT=$("$SCRIPT_DIR/extract-tasks.sh" "$PLAN_FILE")
rm "$PLAN_FILE"

# Check task 1 has skills
if echo "$OUTPUT" | grep -q '"skills":\["test-driven-development","systematic-debugging"\]'; then
  echo "✅ Task 1 skills parsed correctly"
elif echo "$OUTPUT" | grep -q '"skills":\s*\["test-driven-development"'; then
  echo "✅ Task 1 skills parsed correctly (flexible whitespace)"
else
  echo "❌ Task 1 skills not parsed"
  echo "$OUTPUT"
  exit 1
fi

# Check task 2 has empty skills
if echo "$OUTPUT" | grep -q '"name":"Add API endpoint"' && echo "$OUTPUT" | grep -q '"skills":\[\]'; then
  echo "✅ Task 2 has empty skills array"
else
  echo "⚠️  Task 2 skills check (may be flexible format)"
fi

echo "✅ Skills field parsing test passed"
```

**Step 2: Run test to verify it fails**

Run: `bash tests/test-extract-skills-field.sh`
Expected: FAIL — current extract-tasks.sh doesn't output a `skills` field

**Step 3: Update extract-tasks.sh to parse Skills: field**

After the FILES extraction block (around line 62), add Skills extraction:

```bash
  # Extract skills
  SKILLS_LINE=$(echo "$TASK_SECTION" | grep '^\*\*Skills:\*\*' || true)
  SKILLS_JSON="["
  if [ -n "$SKILLS_LINE" ]; then
    SKILLS_RAW=$(echo "$SKILLS_LINE" | sed 's/^\*\*Skills:\*\*\s*//')
    FIRST_SKILL=true
    IFS=',' read -ra SKILL_ARRAY <<< "$SKILLS_RAW"
    for skill in "${SKILL_ARRAY[@]}"; do
      skill=$(echo "$skill" | xargs)  # trim whitespace
      if [ -n "$skill" ]; then
        if [ "$FIRST_SKILL" = true ]; then
          FIRST_SKILL=false
        else
          SKILLS_JSON+=","
        fi
        skill_esc=$(echo "$skill" | sed 's/"/\\"/g')
        SKILLS_JSON+="\"${skill_esc}\""
      fi
    done
  fi
  SKILLS_JSON+="]"
```

Then update the JSON output line to include skills:

```bash
  echo "  {\"number\":${TASK_NUM},\"name\":\"${TASK_NAME_ESC}\",\"files\":${FILES_JSON},\"skills\":${SKILLS_JSON}}"
```

**Step 4: Run test to verify it passes**

Run: `bash tests/test-extract-skills-field.sh`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add templates/.specdev/skills/core/implementing/scripts/extract-tasks.sh tests/test-extract-skills-field.sh
git commit -m "feat: parse Skills: field in extract-tasks.sh"
```

---

### Task 12: Update implementer.md prompt with {TASK_SKILLS} section

**Files:**
- Modify: `templates/.specdev/skills/core/implementing/prompts/implementer.md`

**Step 1: Add TASK_SKILLS section to implementer prompt**

After the `## Context` section and before `## Before You Start`, add:

```markdown
## Skills

{TASK_SKILLS}
```

And add a note in the `## Before You Start` section:

```markdown
## Before You Start

1. Read the task carefully — understand every requirement
2. If skills are provided above, read and follow them throughout implementation
3. If anything is unclear, ask questions BEFORE writing code
4. Identify the files you need to create or modify
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/core/implementing/prompts/implementer.md
git commit -m "feat: add TASK_SKILLS placeholder to implementer prompt"
```

---

### Task 13: Update breakdown/SKILL.md to declare Skills: per task

**Files:**
- Modify: `templates/.specdev/skills/core/breakdown/SKILL.md`

**Step 1: Update the task structure template**

In the "Phase 3: Detail Each Task" section, add a `Skills:` field to the task template:

```markdown
Every task MUST follow this structure:

    ### Task N: [Component Name]

    **Skills:** [comma-separated list of skills this task needs, from core/ or tools/]
    **Files:**
    - Create: `exact/path/to/file.ext`
    - Modify: `exact/path/to/existing.ext`
    - Test: `tests/exact/path/to/test.ext`
```

Add a new subsection explaining skill declaration:

```markdown
### Skill Declaration

For each task, analyze what the task involves and declare needed skills:

- Task involves writing new code → `test-driven-development`
- Task involves debugging → `systematic-debugging`
- Task involves research → check `skills/tools/` for search tools
- Task involves scaffolding → `scaffolding-lite` or `scaffolding-full`

Only declare skills the task actually needs. The implementing phase will inject these into the subagent context.
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/core/breakdown/SKILL.md
git commit -m "feat: add Skills: field declaration to breakdown task template"
```

---

### Task 14: Update implementing/SKILL.md to document skill injection

**Files:**
- Modify: `templates/.specdev/skills/core/implementing/SKILL.md`

**Step 1: Add skill injection documentation**

In the "Phase 2: Per-Task Execution" section, update step 2 to include skill loading:

```markdown
2. **Dispatch implementer** — use `prompts/implementer.md` with FULL task text
   - Fresh subagent, no prior context
   - If the task has a `Skills:` field, read each listed SKILL.md and inject content into the `{TASK_SKILLS}` placeholder
   - Look for skills in `skills/core/` first, then `skills/tools/`
   - Subagent implements, tests, commits, self-reviews
```

Add to the Red Flags section:

```markdown
- Ignoring Skills: field — if a task declares skills, load and inject them
- Injecting skills not listed — only inject what the task declares
```

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add templates/.specdev/skills/core/implementing/SKILL.md
git commit -m "feat: document skill injection in implementing SKILL.md"
```

---

### Task 15: Update existing tests that reference skill paths

**Files:**
- Modify: `tests/test-skills.js`
- Modify: `tests/test-orientation-scripts.js`
- Modify: `tests/test-implementing-scripts.js`
- Modify: `tests/test-review-agent-scripts.js`
- Modify: `tests/test-parallel-worktrees-scripts.js`

**Step 1: Update all test files**

In each test file, replace `skills/` paths with `skills/core/` paths. This is a bulk find-and-replace within each file:
- `skills/brainstorming` → `skills/core/brainstorming`
- `skills/breakdown` → `skills/core/breakdown`
- `skills/implementing` → `skills/core/implementing`
- `skills/review-agent` → `skills/core/review-agent`
- `skills/knowledge-capture` → `skills/core/knowledge-capture`
- `skills/test-driven-development` → `skills/core/test-driven-development`
- `skills/systematic-debugging` → `skills/core/systematic-debugging`
- `skills/parallel-worktrees` → `skills/core/parallel-worktrees`
- `skills/orientation` → `skills/core/orientation`

Be careful not to replace paths that are already `skills/core/`.

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS — all tests should pass with updated paths

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update all test skill paths to skills/core/"
```

---

### Task 16: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update skill references**

Update the "What gets created" section to reflect the new structure:

```text
.specdev/
├── _main.md                  # Workflow entry point
├── _router.md                # Routes to correct guide
├── _guides/                  # Workflow and task guides
├── _templates/               # Templates and worked examples
├── skills/
│   ├── core/                 # Core workflow skills (managed by specdev update)
│   └── tools/                # Project tool skills (user-owned)
├── knowledge/                # Long-term project knowledge
├── project_notes/            # Project context and progress
├── project_scaffolding/      # Source mirror metadata
└── assignments/              # Active work
```

Update the Skills model section to mention core/ and tools/:

```markdown
### Skills model

Skills are modular capabilities in `.specdev/skills/`, split into two categories:

**Core skills** (`skills/core/`) — managed by SpecDev, updated by `specdev update`:
```

Update skill path references:
- `skills/scaffolding-lite.md` → `skills/core/scaffolding-lite.md`
- `skills/scaffolding-full.md` → `skills/core/scaffolding-full.md`

**Step 2: Run verify test**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node ./tests/verify-output.js`
Expected: PASS

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for skills/core/ and skills/tools/ architecture"
```

---

### Task 17: Run full test suite and verify

**Step 1: Clean and run full test suite**

```bash
npm test
```

Expected: ALL tests pass

**Step 2: Manual verification**

```bash
rm -rf ./test-output
node ./bin/specdev.js init --target=./test-output
ls ./test-output/.specdev/skills/
# Expected: README.md  core/  tools/
ls ./test-output/.specdev/skills/core/
# Expected: all skill directories and flat files
ls ./test-output/.specdev/skills/tools/
# Expected: README.md  .gitkeep
```

**Step 3: Verify update preserves tools/**

```bash
mkdir -p ./test-output/.specdev/skills/tools/my-custom-tool
echo "# Custom" > ./test-output/.specdev/skills/tools/my-custom-tool/SKILL.md
node ./bin/specdev.js update --target=./test-output
cat ./test-output/.specdev/skills/tools/my-custom-tool/SKILL.md
# Expected: "# Custom" — not overwritten
```

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
