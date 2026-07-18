# Implementation Speedup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Speed up implementation by adding `standard` mode (self-review only, no reviewer subagent) and batch execution (groups of 3 tasks).

**Architecture:** Three markdown template files are updated. No CLI code, scripts, or prompts change. The breakdown skill assigns modes; the implementing skill groups tasks into batches.

**Tech Stack:** Markdown templates only

---

### Task 1: Update breakdown SKILL.md — add standard mode and assignment guidance

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/skills/core/breakdown/SKILL.md:50-78`

**Step 1: Update the mode rules in Phase 3**

Replace lines 76-78 (the current mode rules block):

```
Mode rules:
- `full` (default): full TDD + unified review loop (spec compliance + code quality)
- `lightweight`: only for trivial scaffold/config tasks with no meaningful executable behavior
```

With:

```
Mode rules:
- `standard` (default): TDD + implementer self-review only — no reviewer subagent dispatched
- `full`: TDD + reviewer subagent (unified spec + quality review) — use when task is complex or risky
- `lightweight`: no TDD, no review — only for trivial scaffold/config with no executable behavior

Assign `full` when ANY of these apply:
- Task touches 3+ files
- Task introduces new architecture (new module, new pattern, new abstraction)
- Task is security-sensitive (auth, input validation, crypto)
- Task is integration-heavy (wiring multiple components together)
- Task is the last task in the plan (catches accumulated drift)

All other tasks default to `standard`. Use `lightweight` only for trivial scaffold/config.
```

**Step 2: Update the task structure template**

Replace line 55:

```
    **Mode:** full
```

With:

```
    **Mode:** standard
```

**Step 3: Verify the file reads correctly**

Read the modified file and confirm:
- Three modes listed: standard (default), full, lightweight
- Assignment guidance for `full` mode is present
- Task template shows `standard` as the default

**Step 4: Commit**

```bash
git add templates/.specdev/skills/core/breakdown/SKILL.md
git commit -m "docs: add standard mode as default, update mode assignment guidance"
```

---

### Task 2: Update implementing SKILL.md — standard mode handling and batch execution

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/skills/core/implementing/SKILL.md:1-81`

**Step 1: Update the description in frontmatter**

Replace line 3:

```
description: Execute a plan task-by-task with fresh subagents and one review per task
```

With:

```
description: Execute a plan task-by-task with fresh subagents, mode-based review, and batch reporting
```

**Step 2: Update the Contract process line**

Replace line 16:

```
- **Process:** Extract tasks -> dispatch subagent per task -> unified review (spec + quality) -> commit
```

With:

```
- **Process:** Extract tasks -> execute in batches of 3 -> dispatch subagent per task -> mode-based review -> commit -> batch test + report
```

**Step 3: Update the Prompts table**

Replace line 32:

```
| `prompts/code-reviewer.md` | Verify spec compliance first, then code quality | After implementer completes |
```

With:

```
| `prompts/code-reviewer.md` | Verify spec compliance first, then code quality | After implementer completes (`full` mode only) |
```

**Step 4: Rewrite Phase 2 (Per-Task Execution)**

Replace the entire Phase 2 section (lines 42-57) with:

```markdown
### Phase 2: Batch Execution

Execute tasks in batches of 3. For each batch:

#### Per task (within the batch):

1. Run `scripts/track-progress.sh <plan-file> <N> started`
2. **Dispatch implementer** — use `prompts/implementer.md` with FULL task text
   - Fresh subagent, no prior context
   - If the task has a `Skills:` field, read each listed SKILL.md and inject content into the `{TASK_SKILLS}` placeholder
   - Look for skills in `skills/core/` first, then `skills/tools/`
   - Subagent implements, tests, commits, self-reviews
3. **Mode-based review:**
   - `full`: dispatch `prompts/code-reviewer.md` — FAIL/NOT READY blocks; implementer fixes → re-review loop
   - `standard`: self-review only (implementer already did this) — no reviewer subagent
   - `lightweight`: skip review unless the task touched executable logic
4. Run `scripts/track-progress.sh <plan-file> <N> completed`

#### After each batch:

1. Run the full test suite
2. If tests fail: stop, debug, and fix before continuing to the next batch
3. Report batch summary: tasks completed, tests passing, any notable decisions
4. Continue to next batch (no user gate — informational only)

The last batch may have fewer than 3 tasks.
```

**Step 5: Verify the file reads correctly**

Read the modified file and confirm:
- Phase 2 is now "Batch Execution" with batches of 3
- Three mode behaviors documented: full, standard, lightweight
- Batch reporting after each group of 3
- Test suite run after each batch

**Step 6: Commit**

```bash
git add templates/.specdev/skills/core/implementing/SKILL.md
git commit -m "docs: add standard mode and batch execution to implementing skill"
```

---

### Task 3: Update workflow guide and verify

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/_guides/workflow.md:43-45`

**Step 1: Update Phase 3 description**

Replace line 45:

```
**Goal:** Execute tasks, one subagent per task, TDD, review per task.
```

With:

```
**Goal:** Execute tasks in batches of 3, one subagent per task, TDD, mode-based review.
```

**Step 2: Commit**

```bash
git add templates/.specdev/_guides/workflow.md
git commit -m "docs: update workflow guide for batch execution"
```

**Step 3: Run full test suite**

Run: `npm test`
Expected: All test suites pass

**Step 4: Verify no stale references**

```bash
grep -rn "one review per task\|review per task" templates/
```

Expected: No matches to old language (the workflow.md line was the last one)
