# Plan

**Implementation Guides:** []
**Review Guides:** []

## Context

- `.specdev/project_notes/big_picture.md`
- `.specdev/project_notes/roadmap/designs/workflow/lanes/mission/mission_execution.md`
- `.specdev/project_notes/roadmap/designs/workflow/lanes/mission/mission_recovery_and_delivery.md`
- `.specdev/assignments/00058_reintroduce-foreground-inline-implementation-for/outcome.md`
- `.specdev/assignments/00061_add-the-selective-assignment-context-catalog/outcome.md`

## Tasks

### T-1 — Freeze the Mission-wide implementation choice

Cover AC-1. Add a validated Mission implementation-choice model, make approval stop
at the explicit no-default choice, accept `--inline` or `--spawned` only at that
boundary, project the choice through Mission status, and preserve spawned behavior
for already-approved legacy Missions.

### T-2 — Route inline Mission implementation through the main session

Cover AC-2. Propagate the frozen choice to every child Assignment, surface initial,
repair, and resolver foreground obligations through `specdev mission run`, resume from
durable artifacts, and serialize inline waves without leasing worktrees. Preserve the
existing spawned controller path.

### T-3 — Align contracts, guidance, and focused regression coverage

Cover AC-3. Update user-visible Mission/Assignment/workflow guidance and generated
skill mirrors, add focused assertions for selection, freezing, legacy recovery,
inline handoff, repair routing, and mode-dependent wave behavior, and update the
release date before delivery.
