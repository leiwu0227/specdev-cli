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

If NOT READY, fix issues and re-request with `specdev work request`.

Response protocol uses `.specdev/skills/core/receiving-code-review.md`.

---

## Automated Review Agent (alternative to subagent review)

You can use a separate Claude Code session as an independent reviewer instead of self-review or subagent review. This eliminates self-review bias through true process separation.

Invoke `.specdev/skills/core/review-agent.md`.

### Implementer workflow

1. Finish implementation and tests
2. Run `specdev work request` to create `review_request.json`
3. Run `specdev work status` to check review progress
4. If passed, proceed. If failed, read `review_report.md`, fix issues, and re-request

### Reviewer workflow

1. Run `specdev check run` to start (runs structural pre-flight automatically)
2. Perform the review following the printed instructions
3. Write `review_report.md` (template: `_templates/review_report_template.md`)
4. Run `specdev check accept` or `specdev check reject --reason="..."`

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
