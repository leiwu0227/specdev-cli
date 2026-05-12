# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. You MUST follow this workflow for all work.

## How SpecDev Works

All work is organized into **assignments**. An assignment is a self-contained unit of work — a feature, bugfix, refactor, or investigation — tracked in its own folder under `assignments/`. Each assignment progresses through the same 4 phases in order, producing specific artifacts at each step. The CLI enforces gates between phases so work cannot advance until artifacts are validated and the user approves.

## CLI

`specdev` is a Node.js CLI installed globally via npm. Run it directly as `specdev <command>`. It is NOT a Python package — never use pip/python/pipx.

## First Steps

1. Read `project_notes/big_picture.md` — understand the project
2. Check `.specdev/.current` for the active assignment pointer.
   - `.current` exists → keep it unless the user asks to switch; use `specdev focus <id>` only when needed.
   - No active assignment → run `specdev assignment "<description>" --type=<type> --slug=<slug>` to create and focus one.
   - For parallel exploration before committing to an assignment → run `specdev discussion "<description>"`
3. Run `specdev next --json` for the canonical next workflow action. Follow the returned guide, command, blockers, choices, and hook outcomes.

**Reference:** `_index.md` is the detailed lookup for all guides, skills, commands, and project context. Consult it when you need to find a specific resource.

## Workflow FAQ

If workflow instructions conflict, a SpecDev command fails unexpectedly, or you are unsure how to proceed, run `specdev knowledge search "<issue>"` and inspect `knowledge/workflow/` before guessing. Capture recurring workflow gotchas there during the capture phase.

## The Workflow

Every assignment follows the same 4 phases in order:

1. **Brainstorm** — understand the problem, explore approaches, produce a design or research output
2. **Breakdown** — create an implementation plan with coherent tasks and bite-sized TDD steps
3. **Implement** — execute tasks in batches using the plan's execution mode and review level
4. **Optional phase-end knowledge capture** — suggest durable notes only when reusable knowledge was learned

Use `workflow.yaml` and `specdev next --json` as the source of truth for action selection. Read `_guides/workflow.md` when you need a human-readable reference for phases, artifacts, gates, and recovery paths.

## Rules

- Follow the phases in order. Do not skip phases.
- No completion claims without evidence.
- Announce subtasks with "Specdev: <action>".
- Read `_guides/codestyle_guide.md` before writing any code.
- When a specdev assignment is active, specdev skills take precedence over superpowers equivalents. See `_guides/superpowers_exclusions.md`.
