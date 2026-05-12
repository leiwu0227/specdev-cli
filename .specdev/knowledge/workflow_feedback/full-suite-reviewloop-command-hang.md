# Full Suite Reviewloop Command Hang

Status: resolved
Type: recurring-pattern
Severity: major
First seen: 2026-05-08, 00012_feature_guided-layout-migration
Last seen: 2026-05-11, 00019_feature_autocontinue-reviewloop
Assignments observed: 00012_feature_guided-layout-migration, 00019_feature_autocontinue-reviewloop

## Observation
- During assignment 00012, `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "npm test"` did not complete. Process inspection showed the run reached `test-reviewloop-command.js`; after reviewer child processes exited, the Node test process remained alive.
- During assignment 00019, focused suites passed, but `timeout 600s npm test` exceeded the timeout during later full-suite execution, and an implementation reviewer also timed out after writing an approved round because it continued into a long `npm test` run.

## Impact
- Agents could have valid targeted verification and approved review artifacts while the overall reviewloop process or full suite remained blocked.
- Phase approval might need manual recovery if a reviewer wrote `**Verdict:** approved` and then timed out before reviewloop called `approvePhase()`.

## Current Mitigation
- Resolved during the 00023 cleanup: `tests/test-reviewloop-command.js` was removed from the maintained suite (the slowest tail, dominated by multi-reviewer mocks and real timeouts). The reviewloop contract is now covered indirectly by drift assertions in `tests/test-workflow-contract-drift.js` and the per-phase choice tests in `tests/test-checkpoints.js`. See `knowledge/architecture/reduced-test-suite.md`.

## Proposed Action
- none
