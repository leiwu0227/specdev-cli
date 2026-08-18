# Implementation plan

## Fresh knowledge

- Search: `specdev knowledge search "direct documentation adhoc explicit selection meaningful phases orientation handoff"`
- Relevant paths read:
  - `.specdev/assignments/00045_remove-the-live-adhoc-workflow-friction-identifi/outcome.md`
  - `.specdev/assignments/00050_clarify-repository-ownership-and-lane-selection/outcome.md`
- Current authority remains the approved contract and repository source. The
  historical outcomes confirm the existing Adhoc governance and
  cross-repository handoff boundary; neither supersedes current code.
- Unexpected-symptom search: `specdev knowledge search "perl locale C.UTF-8
  panic"` returned no matches after a local Perl rewrite failed before editing.
- Unexpected-symptom search: `specdev knowledge search "codex skills EPERM
  generated host copies workspace"` surfaced
  `.specdev/knowledge/architecture/reduced-test-suite.md`. It was read and not
  used because its old three-test inventory is superseded by the current
  repository and it contains no write-permission recovery guidance.

**Implementation Guides:** none

**Review Guides:** none

The catalog's frontend and api-security guides do not apply to this prose,
generation, and focused-regression change.

## Tasks

1. **T-1 — Clarify Direct and explicitly selected Adhoc routing (AC-1, AC-2).**
   Update the product-owned dispatcher/template guidance, public summary, and
   Adhoc command/skill descriptions so small non-behavioral documentation
   writes are Direct, explicit Adhoc documentation remains governed, and the
   current-repository manual, cross-repository handoff, impact boundary, and
   narrow orientation examples are concrete.
2. **T-2 — Synchronize meaningful-phase announcement guidance (AC-3).**
   Normalize canonical generated skill and adapter wording around meaningful
   phases, then synchronize the repository-tracked `.claude` and `.codex`
   generated skill copies and any product-owned launcher guidance affected by
   that canonical wording. Update `package.json`'s release date for delivery.
3. **T-3 — Add and collect focused acceptance evidence (AC-1, AC-2, AC-3).**
   Extend focused installed-output coverage for classification, examples,
   proportional orientation, generated adapters/skills, and tracked host skill
   synchronization. With explicit user authorization, run only the focused
   regression command; independently inspect the final diff and run a narrow
   whitespace check. Record all evidence and final acceptance results in the
   required progress and outcome artifacts.
