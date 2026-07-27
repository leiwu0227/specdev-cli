# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Classify preserved worker recovery states (AC-1, AC-2, AC-3).**
   Update Assignment implementation recovery to distinguish absent, blocked,
   malformed, artifact-invalid, and completed preserved results. Reuse only a
   strictly parsed completed envelope whose required delivery artifacts pass
   existing validation.
2. **T-2 — Gate replacement workers behind explicit retry authority (AC-2,
   AC-3).** Return distinct actionable blocked diagnostics for every
   non-reusable preserved result without mutating workflow position or spawning
   a provider Attempt. Allow `--retry-worker` to replace those results while
   retaining the normal first-worker path when no result exists.
3. **T-3 — Add focused recovery regressions (AC-1, AC-2, AC-3).** Extend the
   engine integration fixture to assert provider-attempt counts, graph
   advancement, preserved files, distinct diagnostics, explicit replacement,
   and absent-result behavior.
4. **T-4 — Verify the bounded change (AC-1, AC-2, AC-3).** After receiving the
   repository-required test confirmation, run only the focused engine
   integration test and record the exact working-tree revision receipt.
