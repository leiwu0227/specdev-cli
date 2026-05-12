# Progress JSON Init Race (resolved)

Status: resolved
Type: issue
Severity: minor
First seen: 2026-04-25, oceanlive-cli/00007–00010
Last seen: 2026-04-25
Assignments observed: oceanlive-cli/00007, /00008, /00009, /00010

## Observation

`src/commands/implement.js` previously eager-wrote `{}` to
`implementation/progress.json` before the first `track-progress.sh` call.
`track-progress.sh`'s lazy init only runs when the file does not exist, so
the eager write won the race: subsequent `track-progress.sh` calls saw an
empty object and crashed on `data.tasks.find(...)` (and `specdev checkpoint
implementation` failed on `progress.json has no tasks array`).

## Impact

Every new assignment hit the TypeError on the first task; agents either
stopped and asked for help or worked around by seeding `progress.json`
manually, bypassing intermediate-progress tracking.

## Current Mitigation

Resolved. `src/commands/implement.js` no longer eager-writes `progress.json`;
the comment at `implement.js:32` reads "progress.json is lazy-initialized by
…". Lazy init in `track-progress.sh` is now the single owner.

## Proposed Action

none. Re-open if a third initializer ever appears.
