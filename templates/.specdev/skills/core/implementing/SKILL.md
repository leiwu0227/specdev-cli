---
name: implementing
description: Execute a plan task-by-task using the plan's execution mode, TDD discipline, and batch reporting
type: core
phase: implement
input: breakdown/plan.md
output: Implemented code, committed per-task
next: knowledge-capture
---

# Implementing

## Contract

- **Input:** `breakdown/plan.md` from the assignment folder
- **Process:** Extract tasks -> execute in batches of 3 -> execute inline or dispatch subagents based on plan execution mode -> mode-based review -> commit -> batch test + report
- **Output:** Implemented code, committed per-task, with progress tracked
- **Next phase:** knowledge-capture

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `.specdev/skills/core/implementing/scripts/extract-tasks.sh` | Parse plan into structured JSON task list | At the start |
| `.specdev/skills/core/implementing/scripts/prepare-task.sh` | Mark started, resolve skills, output ready-to-use prompt + mode as JSON | Before dispatching each task |
| `.specdev/skills/core/implementing/scripts/complete-task.sh` | Mark completed, store summary, report batch status | After each task completes |
| `.specdev/skills/core/implementing/scripts/track-progress.sh` | Low-level progress primitive (used internally by prepare/complete scripts) | For summary only |

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `.specdev/skills/core/implementing/prompts/implementer.md` | Fresh subagent to implement one task | Per task when execution mode is `subagent` or `parallel` |
| `.specdev/skills/core/implementing/prompts/code-reviewer.md` | Verify spec compliance first, then code quality | After implementer completes (`full` mode only) |

## Process

### Phase 1: Setup

1. Read `breakdown/plan.md`
2. Run `.specdev/skills/core/implementing/scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review — execution mode, how many tasks, their names, file paths
4. Resolve execution mode from the plan header:
   - `inline`: implement tasks directly in this session
   - `subagent`: dispatch a fresh subagent per task
   - `parallel`: use `skills/core/parallel-worktrees/SKILL.md` only for disjoint file ownership
   - Missing or unknown mode: treat as `inline`

### Phase 2: Batch Execution

Execute tasks in batches of 3. For each batch:

#### Per task (within the batch):

1. **Prepare** — run `.specdev/skills/core/implementing/scripts/prepare-task.sh <plan-file> <N>`
   - This marks the task as started, resolves skills, and outputs JSON with `task_number`, `total_tasks`, `mode`, and `prompt`
   - You MUST use the `prompt` field from this output as the task contract — do not construct task instructions manually
2. **Execute task** according to execution mode:
   - `inline`: use the `prompt` as your task contract, then implement, test, commit, and self-review in this session
   - `subagent`: dispatch a fresh subagent with the `prompt` from step 1; fresh subagent, no prior context
   - `parallel`: follow `skills/core/parallel-worktrees/SKILL.md` for isolated worktrees and integration
3. **Mode-based review** — use the `mode` from step 1:
   - `full`: dispatch `.specdev/skills/core/implementing/prompts/code-reviewer.md` — FAIL/NOT READY blocks; fix findings → re-review loop
   - `standard`: self-review only — no reviewer subagent
   - `lightweight`: skip review unless the task touched executable logic
4. **Complete** — run `.specdev/skills/core/implementing/scripts/complete-task.sh <plan-file> <N> "<summary of task changes>"`
   - This marks the task as completed, stores the summary, and reports batch progress

#### After each batch:

1. Run the full test suite
2. If tests fail: stop, debug, and fix before continuing to the next batch
3. Report batch summary: tasks completed, tests passing, any notable decisions
4. Continue to next batch (no user gate — informational only)

The last batch may have fewer than 3 tasks.

### Phase 3: Final Review

1. Run full test suite one final time
2. Run `.specdev/skills/core/implementing/scripts/track-progress.sh <plan-file> summary`
3. Present a summary to the user inline: what was built, tests passing, any notable decisions
4. If this implementation was reached from `reviewloop brainstorm --autocontinue`, run `specdev checkpoint implementation`, then run `specdev reviewloop implementation --reviewer=<same-reviewer> --autocontinue` without asking the user for another decision.
5. Otherwise, tell the user their options:
   - `specdev reviewloop implementation` — automated external review (e.g., Codex)
   - `specdev review implementation` — manual review in a separate session
   - `specdev approve implementation` — skip review and proceed to knowledge capture
6. Stop and wait only in the non-autocontinue path.

## Red Flags

- **Constructing the implementer prompt manually instead of using `prepare-task.sh`** — the script handles progress tracking, skill resolution, and template filling automatically
- Summarizing task text — always send FULL task text to subagent
- Reusing a subagent across tasks in `subagent` mode — fresh context per task
- Forcing subagents onto tightly coupled work — use `inline` when boundaries are unclear
- Accepting first pass without fixing findings — loop until clean
- Skipping `complete-task.sh` after a task finishes — always record completion and summary
- **Loosening a test assertion to make it pass** — before relaxing any assertion, identify whether the test or the implementation is wrong. If the assertion came from `brainstorm/design.md` Success Criteria or `breakdown/plan.md`, the implementation is wrong by definition — trim/refactor to fit, or update the design first with a documented reason. Silent test relaxation is a unilateral spec change.

## Integration

- **Before this skill:** breakdown (creates the plan)
- **After this skill:** knowledge-capture (distill learnings)
- **Review:** User may run `specdev review implementation` for optional holistic review after all tasks complete
