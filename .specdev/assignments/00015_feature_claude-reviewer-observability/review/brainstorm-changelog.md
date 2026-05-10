# Brainstorm changelog

## Round 1

### F1.1 — Heartbeat lacks a testable seam; timing example was inconsistent

**Addressed by:** updates to `brainstorm/design.md`.

1. Added a **Testability seam** subsection under §1 Heartbeat. It
   defines a new helper module `src/utils/reviewer-runner.js`
   (`runReviewerProcess(options)`) that owns child spawn, timers,
   heartbeat, log header/footer, and the capped stdout buffer.
   `runSingleReviewer` becomes the policy layer (config, preflight,
   salvage, verdict) and delegates the mechanical parts to the runner.
   The runner accepts injectable `spawn`, `now`, `setInterval`,
   `clearInterval`, `setTimeout`, `clearTimeout`, plus four sinks
   (`stdoutSink`, `stderrSink`, `heartbeatSink`, `log`). Tests substitute
   a fake spawn (EventEmitter-backed child) and a manually-advanced
   fake clock.
2. Reconciled the heartbeat schedule. With `intervalMs = 30_000` and
   the rule `fire iff now - lastStdoutAt >= 30_000`, a child that emits
   once at t=10s and stays silent through t=70s yields **exactly one**
   heartbeat at t=60s (Δ=50s), not two. The design now contains a
   concrete schedule table illustrating this, and the test plan's
   Test 1 is rewritten to assert one heartbeat call with
   `elapsedMs === 60_000`.
3. Added `src/utils/reviewer-runner.js` to the file-by-file plan and
   adjusted the `src/commands/reviewloop.js` row to reflect that it
   delegates child lifecycle to the runner.

No code changes in this round — design-only.

## Round 2

### F2.1 — Runner/policy seam couldn't support post-salvage footer or stream-json swap

**Addressed by:** revisions to `brainstorm/design.md` §1 Testability seam
and the file-by-file plan; new test case in the test plan.

1. **Footer ordering.** The runner is now defined as **purely
   mechanical**: it owns child spawn, timeout/heartbeat timers, chunk
   dispatch, and the capped stdout buffer, but has **no log or file
   knowledge**. Policy (`runSingleReviewer`) opens the log and writes
   the header *before* calling `runReviewerProcess`, then — *after*
   strict salvage and verdict parsing — writes the footer (which can
   now record `salvaged:<verdict>` or `missing`) and closes the log.
   A new explicit "End-of-run sequence (policy)" subsection lists this
   ordering step by step.
2. **Stream-json swap.** Stdout handling is now a callback the runner
   invokes per chunk (`onStdout`). In text mode the policy's callback
   writes to `process.stdout` and to the log. In stream-json mode the
   policy builds a translator closure (`reviewer-stream-json.js`) that
   feeds chunks through a JSONL parser, writes rendered lines to
   `process.stdout` and the log, and tees raw chunks to a sidecar
   stream the policy opened. The runner never sees the difference, so
   no duplicate raw JSON ends up in the human-readable log.
3. **Heartbeat suppression remains correct in stream-json mode.**
   `lastActivityAt` is reset whenever the runner *delivers* a chunk to
   `onStdout`/`onStderr`, regardless of how policy renders it — so a
   child producing partial JSONL between newlines still keeps the
   heartbeat suppressed.
4. **Test plan addition.** New Test 5 ("Footer is written after
   salvage") stubs `runReviewerProcess` to assert byte ordering in the
   log and that the footer's `Verdict:` reflects the post-salvage
   state. Renumbered subsequent tests.
5. **File-by-file plan updated** to reflect the narrower runner
   responsibilities and the translator's caller-provided sidecar
   stream.

No code changes in this round — design-only.

## Round 3

### F3.1 — Fixed-interval heartbeat could not satisfy the ≤30s silence guarantee

**Addressed by:** revisions to `brainstorm/design.md` §1 Heartbeat,
§Testability seam injectables list, and Test 1 in the test plan.

1. **Algorithm change.** The heartbeat is now a **re-armed one-shot
   watchdog** instead of a fixed `setInterval` with a Δ-based
   suppression check. On spawn we schedule a one-shot for `now + 30s`.
   On every chunk delivered to a handler we cancel the pending one-shot
   and re-arm for `now + 30s`. When the watchdog fires, we emit the
   heartbeat and re-arm. On child close/error/timeout we cancel.

   This collapses the worst-case silent stretch to exactly the
   heartbeat period, so Success Criterion 1 ("no more than 30s of
   silence at any point") now holds for real — not as an aspirational
   ceiling that the algorithm could violate by up to ~60s.

2. **Schedule example replaced.** The §1 table now shows: child writes
   at t=10s → watchdog rearmed for t=40s → fires at t=40s with
   `elapsedMs=40_000` → re-armed for t=70s → child closes at t=65s →
   one-shot cancelled. Net: exactly one heartbeat, exactly 30s after
   the last activity.

3. **Runner signature simplified.** `setInterval`/`clearInterval`
   removed from the injectables list. The watchdog and the hard-kill
   timeout both ride on the single `setTimeout`/`clearTimeout` pair.

4. **Test 1 rewritten** to match the new algorithm: assert no heartbeat
   at t=30s (the t=30s one-shot was cancelled by the t=10s rearm),
   exactly one heartbeat at t=40s with `elapsedMs === 40_000` and
   rendered text `⏳ reviewer running — 40s elapsed`, and no further
   heartbeats after the child closes at t=65s.

No code changes in this round — design-only.

## Round 4

### F4.1 — Reviewer-name input was not validated; stream-json sidecar would replicate the gap

**Addressed by:** new §5 in `brainstorm/design.md`, updated file-by-file
plan, new Success Criterion 0, new Test 8.

1. **New §5 "Reviewer-name validation and safe path construction"**
   spells out:
   - **Allowed shape** is `^[A-Za-z0-9._-]+$`; invalid input is
     rejected with `Invalid reviewer name: "…"` *before* any path is
     constructed.
   - **Must-exist check** against the `*.json` basenames in
     `.specdev/skills/core/reviewloop/reviewers/`; unknown names are
     rejected with `Reviewer config not found: …` plus the existing
     "Available reviewers" listing.
   - **Single source of truth.** A new
     `resolveReviewerNames(specdevPath, rawList)` helper in
     `src/utils/reviewer-preflight.js` returns the validated list; we
     do not normalise (accept-or-reject only).
   - **All path construction uses the resolved name** — config lookup
     in `runSingleReviewer` and `preflightReviewers`, the multi-reviewer
     `feedbackFilename` / `changelogFilename` interpolation, the
     existing `reviewerLogPath`, and the new stream-json sidecar.
2. **Scope.** Treated as in-scope here because the new sidecar is the
   *last* path-interpolation site to be added; deferring would mean
   shipping the new feature with a fresh path that re-exposes the
   exact gap the finding identified.
3. **File-by-file plan updated.** `src/utils/reviewer-preflight.js`
   now also gains `resolveReviewerNames`. `src/commands/reviewloop.js`
   wires the resolved names into every existing path-interpolation
   site — `reviewerLogPath`, `feedbackFilename`, `changelogFilename`,
   config lookup, and the new sidecar.
4. **Success Criterion 0 added** to make the validation a checkable
   acceptance bar, and **Test 8** ("Reviewer name validation")
   exercises `../foo`, `foo/bar`, `foo bar`, `` (empty), `nonexistent`,
   and `claude`, asserting that invalid inputs reject before any
   filesystem touch (verified by a fake `fs` that records read paths).

No code changes in this round — design-only.

## Round 5

### F5.1 — Watchdog could be silently suppressed by unrendered child output

**Addressed by:** changes to `brainstorm/design.md` §1 Heartbeat,
§Testability seam (`onStdout`/`onStderr` signature and rearm semantics),
§4 stream-json translator (thinking blocks rendered as a collapsed
marker), and the test plan (Test 6 sub-cases + new Test 8).

1. **Activity now means user-visible output, not raw bytes.** §1 is
   revised: the watchdog rearms only when the policy invokes a
   `markActivity()` callback the runner passes in `ctx`. Raw chunk
   delivery alone no longer rearms. This closes the loophole where a
   reviewer streams chunks the policy refuses to render and the
   heartbeat stays suppressed indefinitely.
2. **Handler signature updated.** `onStdout`/`onStderr` are now
   `(chunk, ctx) => void` with `ctx = { markActivity() }`. In text
   mode the default handler calls `markActivity()` for any non-empty
   chunk. In stream-json mode the translator calls `markActivity()`
   only when at least one rendered line was emitted to the human sinks
   for that chunk; mid-line buffering does not mark activity.
3. **Thinking blocks are now rendered as a collapsed marker.** §4's
   table adds the row `assistant.thinking → 🤔 thinking…`. Only the
   marker is emitted; chain-of-thought content is still suppressed.
   This serves the user (visible signal during the thinking phase)
   *and* satisfies the watchdog's rearm semantics.
4. **Test plan updated.** Test 6 gains three sub-cases: a thinking
   event marks activity exactly once and emits one collapsed line;
   mid-line chunks do not mark activity; completing the line then
   marks activity once. **New Test 8** covers the original failure
   mode directly: a child emitting unrendered chunks every 5s for 90s
   while `markActivity()` is never invoked must still produce three
   heartbeats at t=30s/60s/90s. Subsequent tests renumbered (former
   Test 8 → Test 9).

No code changes in this round — design-only.

## Round 6

### F6.1 — Runner contract did not preserve process-group termination semantics

**Addressed by:** new "Process termination semantics" subsection in
`brainstorm/design.md` §Testability seam, plus a new integration test
(Test 9 — the former Test 9 becomes Test 10).

1. **Termination semantics now spelled out as runner invariants.**
   The runner spawns via `spawn('bash', ['-c', command], { detached:
   true, stdio: ['ignore', 'pipe', 'pipe'] })`, putting the shell into
   its own process group. On timeout it calls
   `process.kill(-child.pid, 'SIGTERM')`, schedules a 5s grace timer
   (`REVIEWER_TERMINATION_GRACE_MS` promoted to a runner constant),
   and on grace expiry calls `process.kill(-child.pid, 'SIGKILL')`.
   The grace timer is cleared on `child.close`. Both kill calls are
   wrapped in try/catch so they tolerate the race against natural
   exit. The runner resolves with `timedOut: true` immediately after
   sending SIGTERM, matching today's behavior.
2. **Reviewer-config shell pipelines are now explicitly covered.**
   Because the runner kills the process group, any grandchildren a
   reviewer config spawns (e.g. `claude … & wait`, or any shell
   pipeline) are reaped on timeout — no more silently-leaked workers
   masquerading as "the reviewer timed out."
3. **New integration test (Test 9).** Runs
   `bash -c 'sleep 30 & echo "grandchild_pid=$!"; wait'` with
   `timeoutMs = 1000`, captures the grandchild PID, then after the
   grace window asserts `process.kill(grandchildPid, 0)` throws
   `ESRCH`. This is the only test in the plan that uses real `spawn`
   — fakes cannot validate OS-level process-group semantics. Renumbered
   former Test 9 (reviewer-name validation) → Test 10.

No code changes in this round — design-only.
