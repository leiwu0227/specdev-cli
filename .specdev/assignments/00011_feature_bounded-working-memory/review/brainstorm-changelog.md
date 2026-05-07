# Brainstorm Changelog

## Round 1

- F1.1: Addressed by specifying that `specdev memory` follows the `skills` command pattern: register `memory` in `commandHandlers` and route subcommands inside `src/commands/memory.js`, avoiding a new special-case dispatch branch.
- F1.2: Addressed by changing the `distill done` nudge to a machine-readable JSON field, `memory_hint`, so stdout remains parseable.
- F1.3: Addressed by committing to `MAX_WORKING_MEMORY_WORDS = 800` and defining truncation priority: preserve header/refresh instruction, project summary, and current workflow before trimming recent assignments and durable knowledge.
- F1.4: Addressed by choosing `scanAssignments()` plus assignment-state detection as the authoritative source for recent completed assignments, rather than `assignment_progress.md`.
