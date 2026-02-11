# Skill: Parallel Worktrees

## Use when

- Independent tasks can be executed concurrently
- Tasks do not share mutable files or global state

## Parallelization criteria

A task is parallel-safe only if all are true:

- No overlapping file writes
- No shared schema/global config mutation
- No hidden runtime coupling
- Independent test execution paths

## Workflow

1. Create one branch/worktree per parallel task.
2. Run task-specific tests inside each worktree.
3. Merge only after all task gates pass.
4. Re-run full suite on integration branch.

## Deliverable

Record worktree mapping and merge order in `implementation.md`.
