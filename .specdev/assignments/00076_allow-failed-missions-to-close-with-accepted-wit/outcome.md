# Outcome

## Delivered behavior

Failed Missions can close with accepted-with-limitations using the existing acceptance note and exact-plan confirmation. Active and suspended runtimes use existing closure behavior. A completed runtime at the Mission failed node remains byte-for-byte unchanged, including its transition history. Closure retains the original Mission and status snapshots, failure details, and verification evidence. Completed and abandoned Missions remain ineligible.

Updated template guidance and releaseDate. The simplification checkpoint retained the existing closure flow without new commands or abstractions; no broader cleanup was needed.

## Deviations

None.

## Unresolved risks

Existing restrictions on ambiguous ownership, live execution, and unsupported historical layouts remain. The first closure test run exposed a missing child graph in the new paused test fixture; using a parent-only paused fixture resolved it. All three authorized checks then passed. No real Mission was closed.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | node tests/test-mission-closure.js: failed active, suspended, and terminal runtime closure, preview and exact confirmation. | Passed |
| AC-2 | node tests/test-mission-closure.js: original failure snapshot and details, outcome and verification files, terminal checkpoint and transition-log byte preservation. | Passed |
| AC-3 | node tests/test-mission-closure.js: stale-plan refusal, live execution and focus guards, unrelated work preservation, four interrupted recovery boundaries, idempotent retries and terminal policy. npm run test:mission-abandonment and npm run test:mission-landing passed. | Passed |
