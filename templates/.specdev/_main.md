# SpecDev workflow overview

**Version:** 0.0.3 (skills-enabled workflow)

SpecDev keeps work aligned through assignment folders under `.specdev/`.

## Getting Started (For Coding Agents)

1. Understand the project
   - Read `project_notes/big_picture.md`
   - If empty, ask user to fill it before implementation

2. Check current status
   - Read `project_notes/assignment_progress.md`
   - Read `project_notes/feature_descriptions.md`

3. Route correctly
   - Read `_router.md`
   - Read the assignment-type workflow in `_guides/workflow/`

4. Apply complexity gate
   - In planning, decide: no scaffold, `scaffolding-lite`, or `scaffolding-full`
   - Invoke skills from `.specdev/skills/` only when needed

## Core pieces

- `.specdev/_router.md` - starting point that routes to the right guide
- `.specdev/_guides/` - workflow and task guides
- `.specdev/_templates/` - templates and worked examples
- `.specdev/skills/` - independent, on-demand skills
- `.specdev/assignments/` - active work (`#####_type_name` folders)
- `.specdev/project_notes/` - project context and progress
- `.specdev/project_scaffolding/` - source mirror metadata
- `.specdev/knowledge/` - long-term project knowledge

## Assignment flow (short)

1. Confirm scope in `proposal.md`.
2. Write `plan.md` and run complexity/risk gate.
3. Invoke only required skills (for example, scaffolding-lite/full, debugging, worktrees).
4. Implement via TDD with binary task completion criteria.
5. Validate with two-stage review and verification evidence.
6. Finalize documentation and assignment status.

## Rules that always apply

- Read always-apply skills at assignment start: `skills/verification-before-completion.md` and `skills/receiving-code-review.md`.
- No completion claims without command evidence.
- No performative agreement in code review responses.
- Every invoked skill must produce an artifact.
- Record invoked skills in `assignments/#####_type_name/skills_invoked.md`.

Treat this directory as the source of truth and update guides when process changes.
