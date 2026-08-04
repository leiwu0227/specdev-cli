# Implementation plan

## Tasks

### T-1 — Expose integrated workflow-visibility verification

Acceptance: AC-1, AC-2

- Add `test:workflow-visibility` to `package.json`, composing the existing
  `test:attempt-progress`, `test:implement-recovery`, and
  `test:status-visibility` entrypoints exactly once each.
- Add Attempt-progress regression coverage to the default `npm test` chain
  without changing existing focused suite entrypoints or test semantics.

**Implementation Guides:** []

**Review Guides:** []

### T-2 — Verify the integrated entrypoint and delivery artifacts

Acceptance: AC-1, AC-2

- With explicit repository-required test confirmation, run only the authorized
  `npm run test:workflow-visibility` command and record its receipt against the
  dirty candidate revision.
- Inspect the final package-script composition to confirm the default path
  includes Attempt-progress coverage, then record progress and outcome receipts.

**Implementation Guides:** []

**Review Guides:** []
