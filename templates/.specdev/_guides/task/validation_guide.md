# Validation and Quality Gates Guide

**Reference example**: `_templates/assignment_examples/feature/00000_feature_email-validator/validation_checklist.md`

Copy `_templates/gate_checklist.md` to assignment root as `validation_checklist.md`.

---

## Gate 1: Post-architecture review (conditional)

Required when complexity gate selected `scaffolding-lite` or `scaffolding-full`. Skip only for LOW complexity.

- [ ] dependencies and contracts are explicit
- [ ] edge cases documented
- [ ] user approval recorded
- [ ] MEDIUM: user approved contracts in `scaffold/_architecture.md`
- [ ] HIGH: user approved full architecture artifacts

## Gate 2: Per-task TDD validation

After each task cycle:

- [ ] failing test first
- [ ] correct failure reason
- [ ] minimal passing code
- [ ] all tests pass
- [ ] code style and contracts respected

---

## Review: Spec Compliance + Code Quality

Invoke `.specdev/skills/core/requesting-code-review.md`.

Single review pass covering both spec compliance and code quality.

Reviewer checks:

1. **Spec compliance** — implementation matches proposal/plan
   - Deviations listed as `file:line` with expected vs actual
2. **Code quality** — architecture, testing, style
   - Findings tagged `CRITICAL`, `IMPORTANT`, `MINOR`
   - Each finding includes `file:line`, impact, fix suggestion

Verdict: `READY TO MERGE` or `NOT READY`

If NOT READY, fix issues and re-run the subagent review.

Response protocol uses `.specdev/skills/core/receiving-code-review.md`.

---

## Manual Review (optional)

For holistic review beyond the automatic subagent reviews, the user can run `specdev review` in a separate session. This provides a phase-aware, interactive review.

The `specdev review` command:

1. Detects the current assignment phase automatically
2. Reads the relevant phase artifacts
3. Performs a holistic review
4. Discusses findings interactively with the user

This is optional — the primary review mechanism is automatic subagent reviews (spec + code quality) that run per-task during implementation.

---

## Verification-before-completion gate

Invoke `.specdev/skills/core/verification-before-completion.md`.

No completion claims are allowed without command evidence in `validation_checklist.md`.

Required evidence format:

- command
- result / exit code
- key output lines
- notes

---

## Rollback

If critical defects remain, or implementation diverges from approved scope:

1. document in `rollback_notes.md`
2. revert assignment-specific changes
3. update `assignment_progress.md`
4. restart from the failed gate
