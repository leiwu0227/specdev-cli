---
name: implementing
description: Execute a plan task-by-task with fresh subagents and one review per task
type: core
phase: implement
input: breakdown/plan.md
output: Implemented code, committed per-task
next: knowledge-capture
---

# Implementing

## Contract

- **Input:** `breakdown/plan.md` from the assignment folder
- **Process:** Extract tasks -> dispatch subagent per task -> unified review (spec + quality) -> commit
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
| `prompts/code-reviewer.md` | Verify spec compliance first, then code quality | After implementer completes |

## Process

### Phase 1: Setup

1. Read `breakdown/plan.md`
2. Run `scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review — how many tasks, their names, file paths

### Phase 2: Per-Task Execution

For each task in order:

1. Run `scripts/track-progress.sh <plan-file> <N> started`
2. **Dispatch implementer** — use `prompts/implementer.md` with FULL task text
   - Fresh subagent, no prior context
   - If the task has a `Skills:` field, read each listed SKILL.md and inject content into the `{TASK_SKILLS}` placeholder
   - Look for skills in `skills/core/` first, then `skills/tools/`
   - Subagent implements, tests, commits, self-reviews
3. **Unified review** — dispatch `prompts/code-reviewer.md`
   - Reviewer checks spec compliance first; FAIL blocks merge
   - Reviewer then checks quality; CRITICAL findings block merge
   - If FAIL/NOT READY: implementer fixes → re-review (loop until PASS + READY)
   - For `lightweight` mode tasks: skip reviewer unless the task touched executable logic
4. Run `scripts/track-progress.sh <plan-file> <N> completed`

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
