# Codex Sandbox Test Limitations

Status: mitigated
Type: issue
Severity: minor
First seen: 2026-05-08
Last seen: 2026-05-11
Assignments observed: 00012_feature_guided-layout-migration, 00019_feature_autocontinue-reviewloop

## Observation

Codex's sandboxed environment cannot reliably capture `spawnSync` stdout/stderr when running specdev CLI tests. Historically this caused `test-reviewloop-command.js` to report false failures during `specdev reviewloop implementation --reviewer=codex` even when all assertions passed locally.

## Impact

Codex implementation reviewers could flag test failures that did not reproduce outside the sandbox. The user had to verify tests locally and approve the phase manually when Codex reported sandbox-related false failures.

## Current Mitigation

- `tests/test-reviewloop-command.js` was removed in the 00023 cleanup, eliminating the most-affected file.
- The remaining maintained suite uses `spawnSync` too (`test-init.js`, `test-update.js`, `test-checkpoints.js`, etc.), so the same false-failure mode could resurface in Codex sandboxes. When it does, verify locally and approve manually rather than chasing phantom failures.

## Proposed Action

monitor — re-open if the pattern recurs after the maintained suite stabilises.
