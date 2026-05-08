# Guided Migration Command Split

Assignment 00012 changed migration into two explicit paths:

- `specdev migrate` is a non-destructive guide launcher for semantic `.specdev/` layout migration.
- `specdev migrate legacy-assignments` is the old deterministic assignment-root file mover.

Pattern: keep broad, semantic project cleanup as an agent-guided inspect-plan-confirm workflow; keep narrow mechanical migrations behind explicit subcommands. For command routing, follow the `distill`/`distill done` precedent in `dispatch.js` when one parent command owns multiple related behaviors.
