# Full Suite Reviewloop Command Hang

Status: open
Type: recurring-pattern
Severity: major
First seen: 2026-05-08, 00012_feature_guided-layout-migration
Last seen: 2026-05-11, 00019_feature_autocontinue-reviewloop
Assignments observed: 00012_feature_guided-layout-migration, 00019_feature_autocontinue-reviewloop

## Observation
- During assignment 00012, `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "npm test"` did not complete. Process inspection showed the run reached `test-reviewloop-command.js`; after reviewer child processes exited, the Node test process remained alive.
- During assignment 00019, focused suites passed, but `timeout 600s npm test` exceeded the timeout during later full-suite execution, and an implementation reviewer also timed out after writing an approved round because it continued into a long `npm test` run.

## Impact
- Agents can have valid targeted verification and approved review artifacts while the overall reviewloop process or full suite remains blocked.
- Phase approval may need manual recovery if a reviewer writes `**Verdict:** approved` and then times out before reviewloop calls `approvePhase()`.

## Current Mitigation
- When full `npm test` hangs, inspect the process tree before terminating and run assignment-relevant focused suites separately.
- If reviewloop times out after an approved feedback round, verify the feedback artifact and status before manually approving the phase.

## Proposed Action
- create-assignment
