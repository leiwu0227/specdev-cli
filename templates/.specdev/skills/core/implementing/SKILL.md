---
name: implementing
description: Execute a plan task-by-task with fresh subagents, mode-based review, and batch reporting
type: core
phase: implement
input: breakdown/plan.md
output: Implemented code, committed per-task
next: knowledge-capture
---

# Implementing

## Contract

- **Input:** `breakdown/plan.md` from the assignment folder
- **Process:** Extract tasks -> execute in batches of 3 -> dispatch subagent per task -> mode-based review -> commit -> batch test + report
- **Output:** Implemented code, committed per-task, with progress tracked
- **Next phase:** knowledge-capture

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/extract-tasks.sh` | Parse plan into structured JSON task list | At the start |
| `scripts/track-progress.sh` | Mark tasks started/completed, get summary | After each task |

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `prompts/implementer.md` | Fresh subagent to implement one task | Per task |
| `prompts/code-reviewer.md` | Verify spec compliance first, then code quality | After implementer completes (`full` mode only) |

## Process

### Phase 1: Setup

1. Read `breakdown/plan.md`
2. Run `scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review — how many tasks, their names, file paths

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

### Phase 3: Final Review

1. Run full test suite one final time
2. Run `scripts/track-progress.sh <plan-file> summary`
3. Present a summary to the user inline: what was built, tests passing, any notable decisions
4. Ask the user for approval to proceed to knowledge capture
   - If user approves: proceed to knowledge capture
   - If user requests changes: address feedback and re-present

## Red Flags

- Summarizing task text — always send FULL task text to subagent
- Reusing a subagent across tasks — fresh context per task
- Accepting first pass without fixing findings — loop until clean
- Ignoring Skills: field — if a task declares skills, load and inject them
- Injecting skills not listed — only inject what the task declares

## Integration

- **Before this skill:** breakdown (creates the plan)
- **After this skill:** knowledge-capture (distill learnings)
- **Review:** User may run `specdev review implementation` for optional holistic review after all tasks complete
