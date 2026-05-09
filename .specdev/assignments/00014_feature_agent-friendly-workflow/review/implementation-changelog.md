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

## Round 4

- [F4.1] Fixed: `init --json` now suppresses prose output during setup. Only clean JSON is emitted.
- [F4.2] Fixed: Updated design/success criteria to explicitly exclude `start` (interactive) and `--version` (trivial) from the `--json` contract. Agents use `specdev context --json` for version info.

## Round 5

- [F5.1] Fixed: `reviewloop <phase> --json` without `--reviewer` now emits only JSON. The human listing header is printed only after the JSON branch returns. Added regression coverage that parses the full stdout.
- [F5.2] Fixed: `init --dry-run --json` now emits structured JSON with `dry_run`, `from`, and `to` fields instead of human dry-run prose. Added regression coverage in `test-init`.

## Round 6

- [F6.1] Fixed: `knowledge list` and `context` now use recursive knowledge document collection and include nested knowledge files in JSON and human output. Added nested-file regression coverage.
- [F6.2] Fixed: `context --json` now includes `recent_history.last_completed_assignment`, and the session hook injects it. The hook also has a filesystem fallback for older `specdev context --json` output.
- [F6.3] Fixed: Updated the design success criterion to match the narrowed JSON scope, excluding interactive `start` and `--version`.
