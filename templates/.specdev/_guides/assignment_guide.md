## How to complete a proposed assignment

**Reference example**: `.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/`

## Setup rules

- User must provide an assignment name. If missing, ask for it.
- Create `.specdev/assignments/#####_type_name/`.
  - `#####` is the next 5-digit assignment number from `project_notes/assignment_progress.md`.
  - `type` is `feature`, `refactor`, `bugfix`, `familiarization`, etc.
  - `name` is kebab-case.
- Copy `.specdev/_templates/gate_checklist.md` to `review/validation_checklist.md`.
- Copy `.specdev/skills/skills_invoked_template.md` to `skills_invoked.md`.

## Before starting

Read always-apply skills: `skills/core/verification-before-completion.md` and `skills/core/receiving-code-review.md`. These apply to every assignment throughout.

## Workflow

All assignments follow the same 4 phases. See `_guides/workflow.md` for the full guide.

1. **Brainstorm** — interactive Q&A → validated design
2. **Breakdown** — design → executable task plan
3. **Implement** — subagent per task, TDD, review per task
4. **Summary** — capture learnings, update docs

## Assignment folder structure

`.specdev/assignments/[#####_type_name]/`

- `brainstorm/proposal.md` (user)
- `brainstorm/design.md`
- `breakdown/plan.md`
- `research.md` (optional)
- `implementation/implementation.md`
- `implementation/progress.json`
- `review/validation_checklist.md`
- `review_request.json` / `review_report.md`
- `skills_invoked.md`
- `scaffold/` (only when complexity gate requires it)
