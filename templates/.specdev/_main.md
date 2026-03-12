# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. You MUST follow this workflow for all work.

## How SpecDev Works

All work is organized into **assignments**. An assignment is a self-contained unit of work — a feature, bugfix, refactor, or investigation — tracked in its own folder under `assignments/`. Each assignment progresses through the same 4 phases in order, producing specific artifacts at each step. The CLI enforces gates between phases so work cannot advance until artifacts are validated and the user approves.

## CLI

`specdev` is a Node.js CLI installed globally via npm. Run it directly as `specdev <command>`. It is NOT a Python package — never use pip/python/pipx.

## First Steps

1. Read `project_notes/big_picture.md` — understand the project
2. Check `.specdev/.current` for the active assignment pointer
   - `.current` exists → run `specdev focus <id>` if you need to switch, otherwise resume from the listed assignment
   - No active assignment → run `specdev assignment "<description>"` to reserve an ID (this sets `.current` automatically)
   - For parallel exploration before committing to an assignment → run `specdev discuss "<description>"`

**Reference:** `_index.md` is the detailed lookup for all guides, skills, commands, and project context. Consult it when you need to find a specific resource.

## The Workflow

Every assignment follows the same 4 phases in order:

1. **Brainstorm** — understand the problem, explore approaches, produce a design or research output
2. **Breakdown** — decompose into executable tasks with TDD steps
3. **Implement** — execute tasks in batches, subagent per task, mode-based review
4. **Summary** — capture learnings, update project docs, finalize

Read `_guides/workflow.md` for the full phase-by-phase guide with skill references and gates.

## Rules

- Follow the phases in order. Do not skip phases.
- No completion claims without evidence.
- Announce subtasks with "Specdev: <action>".
- Read `_guides/codestyle_guide.md` before writing any code.
- When a specdev assignment is active, specdev skills take precedence over superpowers equivalents. See `_guides/superpowers_exclusions.md`.
