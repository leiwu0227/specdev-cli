# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. You MUST follow this workflow for all work.

## How SpecDev Works

All work is organized into **assignments**. An assignment is a self-contained unit of work — a feature, bugfix, refactor, or investigation — tracked in its own folder under `assignments/`. Each assignment progresses through three required phases, with optional non-blocking phase-end knowledge capture when reusable knowledge was learned. The CLI enforces gates between phases so work cannot advance until artifacts are validated and the user approves.

## CLI

`specdev` is a Node.js CLI installed globally via npm. Run it directly as `specdev <command>`. It is NOT a Python package — never use pip/python/pipx.

## First Steps

1. Read `project_notes/big_picture.md` — understand the project
2. Run `specdev next --json` for the focused guided workflow.
3. If the state is idle, enter the appropriate workflow with `specdev do "<intent>"`.
4. Follow the returned instructions and submit decisions or evidence with the exact `next_action.command_line`.

Assignments already active from a pre-RippleGraph installation continue through
the compatibility runtime until completion. Do not manually edit
`.specdev/.ripplegraph/` or attempt to reconstruct its state.

**Reference:** `_index.md` is the detailed lookup for all guides, skills, commands, and project context. Consult it when you need to find a specific resource.

## Workflow FAQ

If workflow instructions conflict, a SpecDev command fails unexpectedly, or you are unsure how to proceed, run `specdev knowledge search "<issue>"` and inspect `knowledge/workflow/` before guessing. Capture recurring workflow gotchas through optional phase-end knowledge capture.

## The Workflow

Every assignment follows the same 3 required phases in order:

1. **Brainstorm** — understand the problem, explore approaches, produce a design or research output
2. **Breakdown** — create a concise implementation plan with coherent tasks and verification guidance
3. **Implement** — execute tasks using the plan's execution mode and task-level verification

Optional phase-end knowledge capture may suggest durable notes when reusable knowledge was learned.

Use `specdev next --json` and the registered packages under `workflows/` as the source of truth for action selection. Read `_guides/workflow.md` only as a human-readable reference for phases, artifacts, gates, and recovery paths.

## Rules

- Follow the phases in order. Do not skip phases.
- No completion claims without evidence.
- Announce subtasks with "Specdev: <action>".
- Read `_guides/codestyle_guide.md` before writing any code.
- When a specdev assignment is active, specdev skills take precedence over superpowers equivalents. See `_guides/superpowers_exclusions.md`.
