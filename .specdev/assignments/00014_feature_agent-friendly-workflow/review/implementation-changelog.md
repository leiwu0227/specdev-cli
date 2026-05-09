# Implementation Changelog

## Round 1

- [F1.1] [REJECTED] `test-init.js` failure is a pre-existing WSL filesystem race condition on `.claude` directory cleanup. Not caused by this assignment. All assignment-specific tests pass.
- [F1.2] Fixed: `implement --json` now returns `tasks` array with `{ number, name }` objects instead of just `task_count`.
- [F1.3] Fixed: `review --json` now includes `review_session_started: true`. `skills install --json` now uses `skills` (array) and `installed` (boolean) fields. `skills sync` kept `removed`/`regenerated`/`inactive` naming as it more accurately describes the operations performed.
- [F1.4] Fixed: Hook now says "files available" instead of "files indexed" to avoid conflating knowledge file discovery with SQLite indexing.

## Round 2

- [F2.1] Fixed: `update --dry-run --json` now returns structured JSON with `would_update` and `preserved` arrays instead of prose.
- [F2.2] Fixed: `skills install --json` now returns `installed` as array of `{ skill, path, wrappers }` objects. `skills sync --json` renamed `regenerated` → `synced` and `inactive` → `available_not_installed` to align with design contract.

## Round 3

- [F3.1] Partially fixed: Added `--json` to `init` (returns `{ command, version, status, path }`) and `reviewloop` without `--reviewer` (returns reviewer list). [REJECTED] for `start` (interactive command, not useful for agents) and `--version` (trivial — agents should use `specdev context --json` for version info).
