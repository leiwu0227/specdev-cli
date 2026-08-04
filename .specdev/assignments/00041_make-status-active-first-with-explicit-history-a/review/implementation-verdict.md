---
verdict: approved
material_divergence: false
---

## Findings

Scope inspected: `src/utils/status-view.js` (new), `src/commands/engine.js`, `src/utils/commands.js`, `tests/test-status-visibility.js` (new), `tests/test-assignment-shelf.js`, `package.json`, `QUICKSTART.md`. No external dependency was added or upgraded (the `package.json` change touches only `scripts`), so package-manager/registry evidence is not required.

Acceptance criteria:

- AC-1 — Met. `projectStatusViews` (`src/utils/status-view.js:27`) builds one active view containing only focus, lifecycle, optional phase, active Attempt or pending decision, next action, dirty-path summary, and blocker; `runs`, `prompt`, `instructions`, and `output_schema` are absent. `engineCommand` (`src/commands/engine.js:39-63`) prints the concise human render by default and the same active object under `--json`. Receipt: `npm run test:status-visibility` passed, asserting the exact default key set and absence of history fields for active, pending-decision, interrupted, blocked, and idle cases.
- AC-2 — Met. `--history` returns the unmodified upstream result (including `artifact_focus`) for JSON consumers and appends a run-history section to the human view; explicit `assignment status` / `mission status` paths are untouched. Both projections derive from a single validated result rather than independent state derivation, as the contract's important decision requires.

Non-blocking observations:

1. `src/commands/engine.js:64` widens the exit-code condition with `result.lifecycle === 'blocked'`, and that check sits outside the `status` branch, so it applies to every engine command. No current command vocabulary emits `lifecycle: 'blocked'` (assignment lifecycles are `active`/`shelved`/`abandoned`/`completed`/`unknown`), so there is no behavior change today, but the predicate is broader than the status-only scope. Related: default status now exits 1 on a terminally blocked Attempt while `--history` exits 0 for the same state, since the history view is judged on `status` instead.
2. Evidence coverage is unit-level. The passing receipt exercises `projectStatusViews`/`formatStatusView` directly; no receipt executes `engineCommand`, so the CLI wiring (`--history` flag parsing, `buildStatusViews` against a real workspace) is unproven by execution. The candidate edits `tests/test-assignment-shelf.js:162-167` — the only end-to-end assertion of the new shapes — but that file was not run, and I did not credit it. This is consistent with the contract, which delegates only focused status fixtures and reserves integrated verification to the Mission; the Mission run must cover `test-assignment-shelf.js`. Static review of those assertions found no expected failure: the active view exposes `lifecycle` and `focus.id` as strings and omits `runs`, and `--history --json` retains `artifact_focus`.
3. `src/utils/status-view.js:119` falls back to `active.next_action` itself when `command_line` is absent, which would render `[object Object]` for an object-shaped next action. Every current producer supplies `command_line` or a string, so this is latent only.
4. A running Attempt with no local process marker yields liveness `unknown` and is therefore classified `interrupted`. Deterministic and safely worded in the blocker text, but it will report cross-machine or externally launched Attempts as interrupted.

The recorded deviation (first changed-file Prettier check failed, files mechanically formatted, identical recheck passed) is disclosed in both `progress.json` and `outcome.md` and is consistent with the receipts. No blocking contract defect remains.
