## How to complete a proposed assignment

**Reference example**: `.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/`

## Setup rules

- User must provide an assignment name. If missing, ask for it.
- Create `.specdev/assignments/#####_type_name/`.
  - `#####` is the next 5-digit assignment number from `project_notes/assignment_progress.md`.
  - `type` is `feature`, `refactor`, `bugfix`, `familiarization`, etc.
  - `name` is kebab-case.
- Copy `.specdev/_templates/gate_checklist.md` to `validation_checklist.md`.
- Copy `.specdev/skills/skills_invoked_template.md` to `skills_invoked.md`.

## Before starting

Read always-apply skills from `skills/README.md`: `verification-before-completion.md` and `receiving-code-review.md`. These apply to every assignment throughout.

## Standard flow

1. Proposal
   - User creates `proposal.md`.
2. Plan
   - Agent writes `plan.md` using `task/planning_guide.md`.
   - Run complexity/risk gate to decide required skills.
3. Architecture prep (conditional)
   - If gate result is `none`, skip scaffolding.
   - If `lite`, invoke `skills/scaffolding-lite.md` and require Gate 1 approval (contracts).
   - If `full`, invoke `skills/scaffolding-full.md` and require Gate 1 approval (full architecture).
4. Implementation
   - Follow `task/implementing_guide.md`.
   - TDD per task, with binary success criteria.
5. Validation
   - Follow `task/validation_guide.md`.
   - Stage 1 spec compliance review, then Stage 2 quality review.
   - Apply verification-before-completion evidence.
6. Finalize
   - Follow `task/documentation_guide.md`.
   - Update assignment status as DONE.

## Skill logging

For each invoked skill, add one row in `skills_invoked.md` including:

- date
- skill name
- trigger condition
- produced artifact path
- status

## Assignment folder structure

`.specdev/assignments/[#####_type_name]/`

- `proposal.md` (user)
- `plan.md`
- `research.md` (optional)
- `implementation.md`
- `validation_checklist.md`
- `skills_invoked.md`
- `scaffold/` (only when complexity gate requires it)
