---
name: executing
description: Execute a self-executing plan task-by-task with TDD discipline
---

# Executing

## Contract

- **Input:** A plan file at `docs/plans/YYYY-MM-DD-<name>.md` (created by the planning skill)
- **Process:** Parse tasks → execute each sequentially (test-first) → track progress → report completion
- **Output:** Implemented code, committed per-task, with progress tracked in assignment state
- **Next skill:** verification (to confirm everything is done), then knowledge-capture

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/extract-tasks.sh` | Parse a plan file and output structured task list as JSON | At the start, to understand all tasks |
| `scripts/track-progress.sh` | Update progress state (mark tasks started/completed) | After each task completes |

## Process

### Phase 1: Setup

1. Read the plan file referenced in the assignment (or provided directly)
2. Run `scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review the output — it tells you how many tasks, their names, and file paths

### Phase 2: Execute Each Task

For each task in order:

1. Run `scripts/track-progress.sh <plan-file> <task-number> started` to mark it in progress
2. Read the task's complete description from the plan
3. Follow the steps exactly as written:
   - **Step 1:** Write the failing test (copy the code from the plan)
   - **Step 2:** Run the test command — verify it fails as expected
   - **Step 3:** Write the minimal implementation (copy the code from the plan)
   - **Step 4:** Run the test command — verify it passes
   - **Step 5:** Commit with the specified message
4. Run `scripts/track-progress.sh <plan-file> <task-number> completed` to mark it done
5. If a step fails unexpectedly, stop and diagnose before continuing

### Phase 3: Completion

1. Run `scripts/track-progress.sh <plan-file> summary` to confirm all tasks are done
2. Report what was implemented, tests passing, commits made

## When to Use

- You see a plan header that says "Use specdev:executing skill"
- You have a validated plan document (created by the planning skill)
- Tasks are meant to be executed sequentially by a single agent

## When NOT to Use

- Tasks are independent and could run in parallel → use subagent-dispatch instead
- The plan hasn't been validated → run validate-plan.sh first
- You need to design something → use planning skill first

## Red Flags

- Skipping the test step — always run the test, even if the code "looks right"
- Modifying task code beyond what the plan specifies — the plan was validated, follow it
- Continuing past a failing step — stop and diagnose
- Not committing after each task — each task should be an atomic commit
- Skipping track-progress.sh — progress tracking enables resume after interruption

## Integration

- **Before this skill:** planning (creates the plan this skill executes)
- **After this skill:** verification (confirm completion), knowledge-capture (distill learnings)
- **During this skill:** test-driven-development principles apply to every task
