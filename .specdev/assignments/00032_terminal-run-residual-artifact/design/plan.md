# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

### T-1 — Centralize safe checkpoint-less terminal compaction

Acceptance: AC-2

- Extend terminal runtime compaction to distinguish a normal checkpoint from a missing checkpoint.
- Require caller-supplied terminal-owner authority for the missing-checkpoint branch.
- Reject checkpoint-less cleanup when the owner is not terminal, the run is focused, or an owned Attempt is still recorded as running.
- Preserve existing checkpoint status validation, focus clearing, run removal, and Attempt cleanup for normal terminal runs.

### T-2 — Recover durable terminal Assignment residue

Acceptance: AC-1, AC-2

- Make idempotent shelf finalization pass durable shelved-owner authority and delegate checkpoint-less handling to terminal compaction.
- Before new standalone Assignment graph discovery, scan durable terminal Assignment records for matching run directories whose checkpoint is missing and invoke the same safe compaction path.
- Pass durable completed-owner authority from standalone Assignment delivery and Mission completion callers.

### T-3 — Add focused regression coverage

Acceptance: AC-1, AC-2, AC-3

- Extend the Assignment shelf command fixture to reproduce Git-restored checkpoint-less residue, verify idempotent shelf cleanup, and verify later Assignment creation preflight recovery.
- Add narrow retention assertions for non-terminal authority, focused residue, and running Attempt refusal while retaining the existing normal compaction assertion.

### T-4 — Record bounded verification and outcome

Acceptance: AC-1, AC-2, AC-3

- Run only the focused tests if the repository-required explicit approval is available; otherwise record them as skipped without claiming execution.
- Inspect the final diff and record task, verification, deviation, risk, and acceptance receipts in `progress.json` and `outcome.md`.
