# Claude Reviewer Observability Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Make long-running reviewloop reviewer runs observable, diagnosable, and recoverable without changing the review feedback artifact contract.

**Architecture:** Extract child-process mechanics into a runner utility, keep reviewloop policy in `src/commands/reviewloop.js`, and add a dedicated Claude stream-json translator. Reviewer names are validated before config lookup or path construction, and strict stdout salvage is applied only for plain text reviewer output after a clean exit.

**Tech Stack:** Node.js ESM, `child_process.spawn`, `fs-extra`, plain Node test files.

**Execution Mode:** inline

---

### Task 1: Add reviewer runner with heartbeat and timeout ownership
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/utils/reviewer-runner.js`; modify `tests/test-reviewloop-runner.js`; modify `package.json`

**Step 1: Write the failing test**
Create `tests/test-reviewloop-runner.js` with fake child and fake clock tests for:
- stdout activity at virtual `t=10s` rearms the one-shot heartbeat, producing exactly one heartbeat at `t=40s`.
- raw stdout chunks that never call `markActivity()` do not suppress heartbeats at `t=30s`, `t=60s`, and `t=90s`.
- timeout resolves with `{ exitCode: null, timedOut: true }` and calls `process.kill(-pid, 'SIGTERM')`.

Add `test:reviewloop-runner` to `package.json` and include it before `test:reviewloop`.

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop-runner`
Expected: FAIL with module-not-found for `src/utils/reviewer-runner.js`.

**Step 3: Write minimal implementation**
Implement `runReviewerProcess(options)` in `src/utils/reviewer-runner.js`:
- Spawn `bash -c <command>` with `detached: true`, ignored stdin, piped stdout/stderr.
- Return `startedAt`, `endedAt`, `elapsedMs`, `exitCode`, `timedOut`, and capped raw `stdoutBuffer`.
- Use a re-armed one-shot heartbeat timer. Pass `{ markActivity }` to stdout/stderr handlers; only `markActivity()` rearms the heartbeat.
- On timeout, call `process.kill(-child.pid, 'SIGTERM')`, schedule `SIGKILL` after exported `REVIEWER_TERMINATION_GRACE_MS = 5000`, clear the grace timer on close, and resolve immediately with `timedOut: true`.
- Default `onHeartbeat` writes `⏳ reviewer running - <elapsed>s elapsed\n` to stderr.

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop-runner`
Expected: PASS with zero failures.

**Step 5: Commit**
Run:
`git add src/utils/reviewer-runner.js tests/test-reviewloop-runner.js package.json && git commit -m "feat: add reviewloop runner heartbeat"`

### Task 2: Add stream-json translator for Claude reviewer output
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `src/utils/reviewer-stream-json.js`; create `tests/test-reviewloop-stream-json.js`; modify `package.json`

**Step 1: Write the failing test**
Create translator tests covering:
- `system/init`, assistant text, assistant thinking, assistant tool use, user tool result, success result, and error result rendering.
- non-JSON and malformed lines pass through verbatim.
- chunks split mid-line buffer until complete.
- raw chunks are written unchanged to the provided sidecar stream.
- `ctx.markActivity()` is called only when a rendered line is emitted.

Add `test:reviewloop-stream-json` to `package.json` before `test:reviewloop`.

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop-stream-json`
Expected: FAIL with module-not-found for `src/utils/reviewer-stream-json.js`.

**Step 3: Write minimal implementation**
Implement `createReviewerStreamJsonTranslator({ writeRendered, writeRaw })` returning `{ onStdout, flush }`.
Render only safe progress:
- `system/init` -> `> session start (model=<model>)`
- assistant text -> text verbatim, newline-normalized
- assistant thinking -> `> thinking...`
- assistant tool use -> `> tool: <name>(<json args truncated to 80 chars>)`
- user tool result -> `  -> tool ok` or `  -> tool error: <truncated>`
- result success -> `> done (<duration_ms>ms, <num_turns> turns)`
- result error -> `> error: <subtype>`

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop-stream-json`
Expected: PASS with zero failures.

**Step 5: Commit**
Run:
`git add src/utils/reviewer-stream-json.js tests/test-reviewloop-stream-json.js package.json && git commit -m "feat: render claude stream json progress"`

### Task 3: Validate reviewer names before path construction
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/utils/reviewer-preflight.js`; modify `src/commands/reviewloop.js`; modify `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**
Add tests for `--reviewer=../foo`, `foo/bar`, `foo bar`, empty names, `nonexistent`, and an existing `claude`. Assert invalid names fail with `Invalid reviewer name`, unknown names fail with `Reviewer config not found`, and no review/log/feedback files are created for rejected input.

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop-command`
Expected: FAIL because invalid names are not rejected before path construction.

**Step 3: Write minimal implementation**
In `src/utils/reviewer-preflight.js`, add:
- `VALID_REVIEWER_NAME_PATTERN = /^[A-Za-z0-9._-]+$/`
- `availableReviewerNames(specdevPath)`
- `resolveReviewerNames(specdevPath, rawList)`

Update `reviewloopCommand` discussion and assignment paths to call `resolveReviewerNames` immediately after splitting `flags.reviewer`; if resolution fails, print the error and set exit code 1 before `preflightReviewers`.

Update `reviewerLogPath` and multi-review filenames to use the resolved reviewer name directly.

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop-command`
Expected: PASS with zero failures.

**Step 5: Commit**
Run:
`git add src/utils/reviewer-preflight.js src/commands/reviewloop.js tests/test-reviewloop-command.js && git commit -m "fix: validate reviewloop reviewer names"`

### Task 4: Wire runner, log header/footer, strict salvage, and timeout override into reviewloop
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `src/commands/reviewloop.js`; modify `src/utils/reviewer-preflight.js`; modify `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**
Add CLI tests using local shell reviewer configs for:
- log header includes Started, Timeout, Command, and SPECDEV env keys.
- log footer includes Ended, Elapsed, Exit code, Timed out, and Verdict.
- clean exit with stdout containing strict `## Round N` and `**Verdict:** approved` salvages into feedback and footer records `salvaged:approved`.
- wrong round or missing verdict does not mutate feedback and footer records `missing`.
- `SPECDEV_REVIEWER_TIMEOUT=1` overrides config timeout and footer records `Timed out: true`.

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop-command`
Expected: FAIL because current reviewloop closes the log before verdict handling, has no salvage, and ignores `SPECDEV_REVIEWER_TIMEOUT`.

**Step 3: Write minimal implementation**
Update `reviewerTimeoutSeconds(config)` to prefer positive integer `process.env.SPECDEV_REVIEWER_TIMEOUT`.

Refactor `runSingleReviewer` to:
- write the new log header before calling `runReviewerProcess`.
- build plain text handlers that write stdout/stderr to human sinks and log, then call `markActivity()` for non-empty chunks.
- call `runReviewerProcess({ command: config.command, cwd: targetDir, env: childEnv, timeoutMs, heartbeatMs: 30000, ... })`.
- leave the log open until after feedback parsing and salvage.
- attempt strict salvage only when `exitCode === 0`, expected round missing, and stream-json mode is false.
- write the footer after salvage/verdict computation and before returning.

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop-command`
Expected: PASS with zero failures.

**Step 5: Commit**
Run:
`git add src/commands/reviewloop.js src/utils/reviewer-preflight.js tests/test-reviewloop-command.js && git commit -m "feat: improve reviewloop diagnostics and salvage"`

### Task 5: Enable Claude stream-json mode and sidecar logging
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `src/commands/reviewloop.js`; modify `templates/.specdev/skills/core/reviewloop/reviewers/claude.json`; modify `templates/.specdev/skills/core/reviewloop/reviewers/README.md`; modify `.specdev/skills/core/reviewloop/reviewers/claude.json`; modify `.specdev/skills/core/reviewloop/reviewers/README.md`; modify `tests/test-reviewloop.js`; modify `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**
Add tests asserting:
- initialized `claude.json` includes `"stream_json": true`, `--output-format stream-json`, and `--verbose`.
- stream-json reviewer config writes rendered output to the human log and raw output to `<phase>-reviewer-<name>-round-<n>.jsonl`.
- stdout salvage is disabled for stream-json reviewers.
- reviewers README documents heartbeat, stream-json, strict salvage, and `SPECDEV_REVIEWER_TIMEOUT`.

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop && npm run test:reviewloop-command`
Expected: FAIL because Claude config has no stream-json flags and reviewloop does not create the sidecar.

**Step 3: Write minimal implementation**
Detect stream-json when `config.stream_json === true` or `config.command` contains `--output-format stream-json`.

When stream-json is active:
- open sidecar path `${feedbackPhase}-reviewer-${reviewerName}-round-${round}.jsonl`.
- pass child stdout through `createReviewerStreamJsonTranslator`.
- write rendered translator output to stdout and log.
- tee raw chunks to the sidecar.
- flush the translator before feedback parsing.
- skip stdout salvage.

Update Claude reviewer templates and installed workflow config to include the stream-json flags and `stream_json: true`. Update reviewer README.

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop && npm run test:reviewloop-command`
Expected: PASS with zero failures.

**Step 5: Commit**
Run:
`git add src/commands/reviewloop.js templates/.specdev/skills/core/reviewloop/reviewers/claude.json templates/.specdev/skills/core/reviewloop/reviewers/README.md .specdev/skills/core/reviewloop/reviewers/claude.json .specdev/skills/core/reviewloop/reviewers/README.md tests/test-reviewloop.js tests/test-reviewloop-command.js && git commit -m "feat: enable claude reviewloop stream json"`

### Task 6: Final verification and capture-ready checklist
**Mode:** full
**Skills:** test-driven-development, verification-before-completion
**Files:** Modify `tests/test-reviewloop.js`; modify `tests/test-reviewloop-command.js`; create `review/validation_checklist.md` under the assignment

**Step 1: Write the failing test**
Add any missing integration coverage from the design test plan that was not covered in Tasks 1-5, prioritizing process-group timeout behavior if it can run reliably on this platform.

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL only if a missing edge case remains unimplemented.

**Step 3: Write minimal implementation**
Fix remaining edge cases without changing the review artifact contract.

**Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS with zero failures.

**Step 5: Commit**
Before committing, confirm `package.json` has `"releaseDate": "2026-05-10"`.
Run:
`git add src tests templates package.json .specdev/assignments/00015_feature_claude-reviewer-observability/review/validation_checklist.md && git commit -m "test: cover reviewloop observability"`
