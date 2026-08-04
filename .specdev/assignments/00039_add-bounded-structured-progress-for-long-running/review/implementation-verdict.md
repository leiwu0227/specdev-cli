---
verdict: approved
material_divergence: false
---

## Findings

Scope inspected: untracked `src/utils/attempt-progress.js` (200 lines), `tests/test-attempt-progress.js` (133 lines), and the tracked diffs to `src/utils/spawned-agent.js` (+81/-12) and `package.json`. `git status` was used so the untracked candidate files were not missed.

Acceptance results, both with a final result and supporting receipt (`npm run test:attempt-progress`, `working-tree@4f376e2`, passed, 83 ms — reused, not re-run):

- AC-1 satisfied. `buildAttemptProgress` (`src/utils/attempt-progress.js:84`) produces one validated object carrying attempt identity, role, milestone phase, `elapsed_ms`, `process_liveness`, `log_liveness`, last valid milestone, and a `fresh`/`quiet`/`stale` classification. `formatAttemptProgress` (`:132`) is a pure projection of that same object into concise human text or a `specdev.attempt_progress` JSON line, and `spawnInvocation` emits it immediately plus every 15 s on stderr (`src/utils/spawned-agent.js:474-500`), so final command JSON on stdout is untouched. `runForegroundShell` forwards child stderr under `--json` (`src/commands/mission.js:3072-3075`), so the structured projection is actually observable.
- AC-2 satisfied. Absent milestone returns the retained previous value with no diagnostic (`:50`); malformed, oversized (checked twice — `stat.size` and short-read length, `:36`/`:41`), non-regular, unknown-field, bad-version, control-character, future-dated, and secret-looking content all degrade to a fixed diagnostic code while keeping the last valid milestone. Diagnostics are enum-like codes; no file content, prompt text, or reasoning is echoed. The whole emission path is wrapped in `.catch()` with a bounded `progress_io_error` fallback, so a throw from `buildAttemptProgress`/`writeAttemptProgress` cannot crash the controller. Progress is written only to `.specdev/cache/attempts/*.progress.json`; no `updateAttemptRecord` call is added, so lifecycle disposition is unchanged.

Safety and invariant checks that passed:

- Path safety: `attemptProgressPaths` reuses the exact `ATTEMPT_ID_PATTERN` already enforced in `src/utils/process-record.js:7`, and is called after `createAttemptRecord` has already applied the same check, so it adds no new throw surface; traversal input is covered by a fixture (`tests/test-attempt-progress.js:128`).
- The milestone file cannot trip reviewer write-violation detection: `trackedStateDigest` excludes `.specdev/cache/**` and uses `--exclude-standard`, and `.specdev/.gitignore` already ignores `cache/`.
- Milestone reads use `O_NOFOLLOW`, a fixed 4 KiB read ceiling, and are the only new filesystem input; writes are temp-file-then-move.
- No dependency was added or upgraded — `package.json` changes are limited to a new `test:attempt-progress` script and adding the new test to the `lint` file list; no lockfile change. Package-manager/registry evidence is therefore not required.
- `prettier --check` on the four touched files reports clean, so the CI `npm run lint` step is not broken. `releaseDate` is already `2026-08-04`, satisfying the repository rule.

Non-blocking observations (no contract defect, no action required for approval):

- `tests/test-attempt-progress.js` is reachable only via its dedicated script and is not in the `npm test` aggregate, so CI will not exercise it. This matches existing repo practice — many test files (`test-agents.js`, `test-migrate.js`, the `test-skills-*` set) also sit outside the aggregate.
- The 60 s heartbeat was previously suppressed when `SPECDEV_AGENT_STREAM=1`; the replacement progress line now emits in that mode too, so it interleaves with streamed provider output. That is consistent with the Mission's visible-progress intent.

No blocking contract defect remains; delivered behavior matches the frozen contract and design plan, and the outcome's claimed deviations ("None") and risks ("None") are consistent with what the diff shows.
