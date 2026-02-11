# Skill: Systematic Debugging

## Use when

- Bug cause is unclear
- Multiple plausible causes exist
- Prior attempts failed or regressed behavior

## Workflow

1. Reproduce with deterministic steps.
2. Capture evidence (logs, stack traces, failing test).
3. Form top hypotheses (ranked by likelihood).
4. Run one experiment per hypothesis.
5. Confirm root cause with disproof of alternatives.
6. Add regression test before final fix.

## Deliverable

Write findings to `research.md`:

- Reproduction status
- Hypotheses and experiment results
- Confirmed root cause
- Regression test reference

## Acceptance

- Fix is tied to a confirmed root cause, not symptom-only patching
