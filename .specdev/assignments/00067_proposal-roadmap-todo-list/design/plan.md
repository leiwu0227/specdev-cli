# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Context

- `.specdev/assignments/00067_proposal-roadmap-todo-list/brainstorm/contract.md`
- `.specdev/discussions/D00022_allow-roadmap-todo-md-for-non-architecture-work-/brainstorm/design.md`
- `.specdev/project_notes/roadmap/designs/workflows/roadmap.md`
- `.specdev/knowledge/architecture/reduced-test-suite.md`
- `src/commands/roadmap.js`
- `src/commands/init.js`
- `hooks/session-start.sh`
- `.claude/skills/specdev-roadmap/SKILL.md`
- `.codex/skills/specdev-roadmap/SKILL.md`
- `.claude/hooks/specdev-session-start.sh`
- `src/utils/update.js`
- `src/utils/assignment-vnext.js`
- `templates/.specdev/_main.md`
- `templates/.specdev/_index.md`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/skills/README.md`
- `templates/.specdev/project_notes/roadmap/`
- `tests/test-init-platform.js`

## Tasks

1. **T-1 — Expose the Roadmap Todo contract and scaffold (AC-1, AC-2).** Add the canonical `todo.md` template and expose it as a standard writable Roadmap file with explicit purpose, ordering, item-cap, and no-provenance rules.
2. **T-2 — Keep generated guidance and update behavior aligned (AC-2, AC-3).** Update embedded and template Roadmap guidance to distinguish request-derived Todo work from design-derived Forecast gaps, and backfill the scaffold only when absent.
3. **T-3 — Narrow placeholder detection and add focused regression coverage (AC-4; supports AC-1–AC-3).** Permit legitimate `todo.md` and `# Todo` domain text while retaining rejection of genuine `TODO` markers, and extend existing platform/update tests for the new behavior.

## Verification

Repository instructions require explicit user approval before any test command. After implementation, request that approval before running the focused test files for Roadmap init/update behavior and Assignment contract validation.
