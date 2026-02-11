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

## Gate 3: Stage 1 spec compliance review

Invoke `.specdev/skills/requesting-code-review.md`.

Reviewer checks implementation against proposal/plan and outputs:

- `PASS` or `FAIL`
- deviations as `file:line` with expected vs actual

If FAIL, fix and rerun Gate 3 from scratch.

## Gate 4: Stage 2 code quality review

Invoke `.specdev/skills/requesting-code-review.md`.

Reviewer outputs:

- `READY TO MERGE` or `NOT READY`
- findings tagged `CRITICAL`, `IMPORTANT`, `MINOR`
- each finding includes `file:line`, impact, fix suggestion

Response protocol uses `.specdev/skills/receiving-code-review.md`.

---

## Automated Review Agent (alternative to subagent review)

For Gates 3-4, you can use a separate Claude Code session as an independent reviewer instead of self-review or subagent review. This eliminates self-review bias through true process separation.

Invoke `.specdev/skills/review-agent.md`.

### Implementer workflow

1. Finish implementation and tests
2. Run `specdev review request --gate=gate_3` to create `review_request.json`
3. Run `specdev review wait` — blocks until the reviewer finishes
4. If passed, proceed. If failed, read `review_report.md`, fix issues, and re-request

### Reviewer workflow

1. Run `specdev review run` to start (runs structural pre-flight automatically)
2. Perform the gate review following the printed instructions
3. Write `review_report.md` (template: `_templates/review_report_template.md`)
4. Run `specdev review accept` or `specdev review reject --reason="..."`

---

## Verification-before-completion gate

Invoke `.specdev/skills/verification-before-completion.md`.

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
