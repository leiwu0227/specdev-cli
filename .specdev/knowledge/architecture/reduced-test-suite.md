# Reduced Test Suite

SpecDev CLI intentionally keeps a compact command-level smoke/regression suite instead of one test file per source module.

The retained suite focuses on user-blocking workflow surfaces: init/update source-of-truth behavior, assignment and `.current` handling, workflow contract drift, knowledge/memory basics, workflow-agent smoke coverage, and approve/checkpoint gates.

Reviewloop runtime behavior is intentionally *not* tested end-to-end. The previous `tests/test-reviewloop-command.js` was the dominant slow tail (multi-reviewer mocks, real timeouts, heartbeat polling) and was removed during the 00023 cleanup. Reviewloop's contract is still covered indirectly: `tests/test-workflow-contract-drift.js` asserts that generated `specdev-reviewloop` skill prose carries the autocontinue contract strings, and `tests/test-checkpoints.js` validates the per-phase choice interaction (`reviewloop_autocontinue` id, `--autocontinue` flag, reviewer-selection rules) that gates `specdev reviewloop`. Real reviewer subprocess behavior is exercised by users via the reviewloop CLI itself.

Avoid reintroducing narrow implementation-detail tests unless they protect a shipped user-facing failure mode that is not covered by a command flow.

## Source
- Assignment: 00020_refactor_reduce-test-suite (initial reduction)
- Assignment: 00023_familiarization_codebase-consistency-audit (reviewloop test removal)
- Last updated: 2026-05-12
