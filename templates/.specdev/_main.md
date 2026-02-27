# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. You MUST follow this workflow for all work.

## How SpecDev Works

All work is organized into **assignments**. An assignment is a self-contained unit of work — a feature, bugfix, refactor, or investigation — tracked in its own folder under `assignments/`. Each assignment progresses through the same 4 phases in order, producing specific artifacts at each step. The CLI enforces gates between phases so work cannot advance until artifacts are validated and the user approves.

## First Steps

1. Read `project_notes/big_picture.md` — understand the project
2. Check `assignments/` for active work
   - Active assignment exists → determine your current phase and resume
   - No assignment → run `specdev assignment "<description>"` to reserve an ID

**Reference:** `_index.md` is the detailed lookup for all guides, skills, commands, and project context. Consult it when you need to find a specific resource.

## The Workflow

Every assignment follows the same 4 phases in order:

1. **Brainstorm** — understand the problem, explore approaches, produce a design or research output
2. **Breakdown** — decompose into executable tasks with TDD steps
3. **Implement** — execute tasks with subagent dispatch, review per task
4. **Summary** — capture learnings, update project docs, finalize

Read `_guides/workflow.md` for the full phase-by-phase guide with skill references and gates.

## Rules

- Follow the phases in order. Do not skip phases.
- No completion claims without evidence.
- Announce subtasks with "Specdev: <action>".
- Read `_guides/codestyle_guide.md` before writing any code.
