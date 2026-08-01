# Implementation plan

## Tasks

### T-1 — Narrow verification obligation identity

- Acceptance: AC-1, AC-2
- Change verification receipt reduction to key retry obligations by exact command and revision only, leaving receipt data and chronology untouched.

### T-2 — Update focused regression fixtures

- Acceptance: AC-1, AC-2
- Model Assignment 00036's failed-then-passed receipts with their differing scope prose and assert that the later pass closes the earlier failure without altering either receipt.
- Retain focused independence checks for different commands and revisions, plus explicit follow-up and failed/blocked acceptance outcomes.

### T-3 — Record bounded verification and outcome

- Acceptance: AC-1, AC-2
- Run only `npm run test:mission-compatibility` if explicit repository-required test approval is available; otherwise record the missing permission as blocked.
- Write the exact-shape progress receipt and concise acceptance outcome from the resulting evidence.

**Implementation Guides:** []

**Review Guides:** []
