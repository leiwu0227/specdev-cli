---
name: subagent-dispatch
description: Fresh subagent per task with two-stage review — no context pollution
---

# Subagent Dispatch

## Contract

- **Input:** A validated plan with independent tasks
- **Process:** Dispatch fresh subagent per task → spec review → code quality review → repeat
- **Output:** Fully implemented plan with all tasks reviewed and committed
- **Next skill:** verification

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/checkpoint.sh` | Save/restore dispatch progress state | After each task completes, or to resume |

## Prompts

| Prompt | Purpose | When to use |
|--------|---------|-------------|
| `prompts/implementer.md` | Template for implementer subagent | Dispatch to a fresh subagent per task |

## Process

### Phase 1: Read Plan

1. Read the plan file
2. Extract all tasks (use `executing/scripts/extract-tasks.sh` if available)
3. Understand task dependencies — which can run in parallel, which are sequential
4. Run `scripts/checkpoint.sh status <assignment-path>` to check for prior progress

### Phase 2: Per-Task Dispatch

For each task in order:

1. **Dispatch implementer:**
   - Use `prompts/implementer.md` template
   - Fill in the FULL task text (not a summary — the complete task from the plan)
   - The subagent must be FRESH — no prior context from other tasks
   - Let the subagent implement, test, and commit

2. **Spec review:**
   - After the subagent completes, run spec review
   - Compare what was implemented against the task requirements
   - If deviations found: fix them (dispatch another subagent or fix directly)

3. **Code quality review:**
   - After spec review passes, run code quality review
   - Use `code-review/prompts/code-reviewer.md` template
   - If CRITICAL findings: fix and re-review
   - Loop until approved

4. **Checkpoint:**
   - Run `scripts/checkpoint.sh save <assignment-path>` to save progress
   - This enables resume if the session is interrupted

### Phase 3: Final Review

After all tasks are complete:

1. Run the full test suite one final time
2. Review the integration of all tasks together
3. Check for any inter-task issues that individual reviews might have missed

### Phase 4: Checkpoint Complete

1. Run `scripts/checkpoint.sh save <assignment-path>` with final state
2. Report: all tasks implemented, reviewed, and committed

## Critical Rules

- **Full task text to subagent** — never summarize, always send the complete task from the plan
- **Fresh subagent per task** — no context pollution between tasks
- **Spec before quality** — always check spec compliance before code quality
- **Review loops until approved** — don't skip reviews, loop until clean

## Red Flags

- Summarizing task text instead of sending full task — the subagent needs ALL the details
- Reusing a subagent across tasks — fresh context per task prevents pollution
- Skipping spec review — checking quality of wrong code is waste
- Accepting first review pass without fixing findings — loop until clean
- Not checkpointing — if the session dies, progress is lost

## Integration

- **Before this skill:** planning (creates the plan to dispatch)
- **After this skill:** verification (final gate checks)
- **Uses:** code-review prompts, spec-review, executing scripts
