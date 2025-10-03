# SpecDev workflow overview

**Version:** 0.0.2 (assignment-first restructure)

SpecDev keeps work aligned through assignment folders under `.specdev/`. Use this page as a quick map before diving into the guides.

## Core pieces
- `.specdev/_router.md` – starting point that points you to the right guide.
- `.specdev/_guides/` – reference library for codestyle and assignment guidance.
  - `_guides/task/` – repeatable steps (planning, scaffolding, implementing, validation, research, presentation)
  - `_guides/workflow/` – domain-specific sequencing (feature, refactor, familiarization, bugfix)
  - See `_guides/README.md` for the complete index
- `.specdev/assignments/` – active work, one `#####_type_name` folder per assignment tracked in `project_notes/assignment_progress.md`.
- `.specdev/_templates/` – scaffolding template, gate checklist, and worked examples you can copy when kicking off a similar assignment.
- `.specdev/project_scaffolding/` – lightweight mirror of important source files, updated at Gate 5.
- `.specdev/project_notes/` – shared context including big_picture.md (goals), assignment_progress.md (status), and feature_descriptions.md (what's built).

## Assignment flow (very short version)
1. Confirm scope in `proposal.md` (see `assignment_guide.md`).
2. Plan and gather facts in `plan.md`.
3. Scaffold each future source file, get Gate 1 approval.
4. Implement tasks with Gate 2 checks, then clear Gates 3–5 (tests, integration, docs/scaffolding).

## First steps for new contributors
- Read `.specdev/_router.md` and the workflow guide for your assignment type.
- Skim `project_notes/big_picture.md` and `assignment_progress.md` to understand current priorities.
- Reuse templates or examples instead of rewriting boilerplate.

Treat this directory as the source of truth: when the process evolves, update the relevant guide rather than duplicating details here.
