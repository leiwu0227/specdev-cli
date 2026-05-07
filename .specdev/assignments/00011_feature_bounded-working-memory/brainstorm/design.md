# Bounded Working Memory

## Overview

SpecDev's knowledge capture is assignment-oriented: completed work produces capture diffs, updates project notes, and may add durable knowledge files. That is good for correctness and auditability, but agents still need to reread several files to recover the most important current facts. Hermes uses a small always-on memory layer; SpecDev can adopt the useful part as a generated markdown artifact rather than a database-backed session memory system.

This assignment adds `.specdev/project_notes/working_memory.md`: a bounded, deterministic summary of the most useful project facts and recent durable learnings. The file should be generated from existing artifacts so it remains reviewable in git and does not become another hand-maintained source of truth.

## Goals

- Add a generated `.specdev/project_notes/working_memory.md` file.
- Keep the file bounded by a clear line or word limit so it remains cheap for agents to read.
- Add a command, likely `specdev memory refresh`, that regenerates the file from current SpecDev artifacts.
- Include high-signal sections such as project summary, active workflow facts, recent completed assignments, and recent knowledge notes.
- Integrate the command into help/README so humans and agents can discover it.
- Keep the first version deterministic and testable with existing plain Node.js tests.

## Non-Goals

- Do not introduce SQLite or searchable session history in this assignment.
- Do not create user-authored long-term memory editing workflows.
- Do not replace `big_picture.md`, `feature_descriptions.md`, assignment captures, or `knowledge/` branches as sources of truth.
- Do not auto-inject large memory content into every command output.
- Do not use an LLM to summarize content; generation should be deterministic.

## Design

Add a new command family `specdev memory`, with `specdev memory refresh` as the first subcommand. It should follow the existing `skills` command pattern: register `memory` in `commandHandlers` and route subcommands inside `src/commands/memory.js`, rather than adding another special-case branch to `dispatch.js`. The command resolves the target project, requires `.specdev/`, and writes `.specdev/project_notes/working_memory.md`.

The generated file should be markdown with a stable header that says it is generated and should not be hand-edited. Suggested sections:

- `Project`: first useful paragraph or compact excerpt from `project_notes/big_picture.md`
- `Current Workflow`: active assignment name/state from the same state machinery used by `specdev status`, when available
- `Recent Completed Assignments`: newest completed assignments from `scanAssignments()` plus existing assignment-state detection, capped by `MAX_RECENT_ASSIGNMENTS = 5`, not from the hand-edited `assignment_progress.md` table
- `Durable Knowledge`: alphabetically selected notes from `.specdev/knowledge/architecture`, `.specdev/knowledge/workflow`, and `_workflow_feedback`
- `Refresh`: command and timestamp/date context

Keep the output bounded with `MAX_WORKING_MEMORY_WORDS = 800`. Generation should build sections in priority order, then truncate by dropping or shortening lower-priority content before higher-priority content. Priority order should be:

1. Header and refresh instruction
2. Project summary
3. Current workflow
4. Recent completed assignments
5. Durable knowledge notes

If the generated content exceeds the word limit, trim durable knowledge first, then recent assignments, then current workflow details. The project summary and generated-file warning should remain. The bound should be tested.

`specdev distill done <assignment>` should not silently rewrite unrelated project notes in this first version unless the behavior is clearly tested. Instead, successful JSON output should include a machine-readable hint field such as `"memory_hint": "Run specdev memory refresh"`. This keeps stdout parseable as JSON while nudging humans and agents to refresh memory. A later assignment can make auto-refresh opt-in.

## Success Criteria

- `specdev memory refresh` creates `.specdev/project_notes/working_memory.md`.
- The generated file includes project context, recent assignment signal, and knowledge note signal.
- The generated file is bounded by the chosen limit.
- Re-running the command is idempotent when inputs have not changed.
- `specdev memory refresh --json` emits machine-readable status with output path and limit metadata.
- `specdev distill done <assignment>` returns a JSON `memory_hint` field after successful completion.
- README/help list the new memory command.
- Targeted tests and full `npm test` pass.
