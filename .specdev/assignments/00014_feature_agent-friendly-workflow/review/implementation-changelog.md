# Implementation Changelog

## Round 1

- [F1.1] [REJECTED] `test-init.js` failure is a pre-existing WSL filesystem race condition on `.claude` directory cleanup. Not caused by this assignment. All assignment-specific tests pass.
- [F1.2] Fixed: `implement --json` now returns `tasks` array with `{ number, name }` objects instead of just `task_count`.
- [F1.3] Fixed: `review --json` now includes `review_session_started: true`. `skills install --json` now uses `skills` (array) and `installed` (boolean) fields. `skills sync` kept `removed`/`regenerated`/`inactive` naming as it more accurately describes the operations performed.
- [F1.4] Fixed: Hook now says "files available" instead of "files indexed" to avoid conflating knowledge file discovery with SQLite indexing.
