# Outcome

## Delivered behavior

The working-tree candidate adds a shared active/history status view, concise
human output, active-first JSON, `--history` compatibility for human and JSON
consumers, bounded dirty-path and Attempt summaries, focused fixtures, help,
and quick-start guidance. Explicit Assignment and Mission status commands are
unchanged.

## Deviations

The first changed-file formatting check found two files; both were mechanically formatted and the recheck passed.

## Unresolved risks

None.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `npm run test:status-visibility` passed active, pending-decision, blocked, interrupted, idle, human, and JSON projections. | Passed |
| AC-2 | `npm run test:status-visibility` passed explicit-history compatibility fixtures; the final changed-file Prettier check also passed. | Passed |
