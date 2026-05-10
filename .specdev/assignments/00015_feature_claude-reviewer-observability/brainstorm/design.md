# Design

## Overview

Improve Claude reviewer observability and reliability in `specdev reviewloop`
without changing the review-artifact contract.

### Why Claude is silent today

`claude --print` is the non-interactive single-shot mode. Its default
`text` output emits **only the final assistant message** at the end of the
run. Combined with `--effort high` (extended thinking, no plain-text output
during thinking) and tool-use round trips (also invisible under `text`), the
reviewer can stay silent for the entire run until it finishes.

The only first-party way to surface live progress from `claude --print` is
`--output-format stream-json --verbose`, which emits a JSONL stream of
`system / assistant / user (tool_result) / result` events as they occur. The
artifact contract (`## Round N … **Verdict:** …` appended to the feedback
file by the reviewer) is unchanged — that file is written via the same tool
use the reviewer already performs.

### High-level decisions

1. **Universal parent-side heartbeat** for any reviewer (Claude or otherwise).
2. **Stream-json upgrade** for the Claude reviewer config so the silent
   stretch becomes real progress.
3. **Strict stdout salvage** when the reviewer exits cleanly but the feedback
   file is missing the expected `## Round N`.
4. **Per-reviewer timeout override** via `SPECDEV_REVIEWER_TIMEOUT`,
   default unchanged at `1200s`.
5. **Richer reviewer log** with start/end timestamps, elapsed seconds,
   final status, and SPECDEV\_\* env summary.

## Goals

- Make it visible that a reviewer is still running during long silent
  stretches, regardless of which reviewer CLI is used.
- Replace Claude's opaque silent stretch with real progress (model init,
  tool calls, assistant text) when running through `reviewloop`.
- Make reviewer-log files self-contained: a user reading the log alone can
  tell when the run started, how long it took, what env it ran with, how
  it ended, and the final verdict status.
- Auto-recover safely when Claude exits cleanly but forgets to write the
  feedback file, using strict pattern matching only.
- Allow per-run timeout overrides for slow assignments without editing
  reviewer JSON configs.

## Non-Goals

- Changing the verdict semantics, feedback filename/path, max rounds, or
  the existing approve/check-review flow.
- Rendering Claude's thinking/chain-of-thought content in the log or to
  the user.
- Lenient stdout salvage (synthesizing missing round headers, accepting
  partial verdicts, etc.).
- Adaptive timeouts that extend on stdout activity.
- Reviewer-side instrumentation changes — all observability is
  parent-side except for the `claude.json` flag change.

## Design

### 1. Parent-side heartbeat

Implemented behind a new helper module so it has a testable seam (see
§Testability seam below); `runSingleReviewer` in `src/commands/reviewloop.js`
delegates child lifecycle to that helper.

The heartbeat is a **re-armed one-shot watchdog**, not a fixed
`setInterval`. This is what guarantees Success Criterion 1 ("no more
than 30s of silence at any point"):

- On spawn, schedule a one-shot timer for `now + 30_000` ms.
- The watchdog is rearmed **only when the policy reports user-visible
  activity**, not on every raw child byte. The runner exposes a
  `markActivity()` callback to handlers; handlers invoke it iff they
  emitted at least one user-visible line (rendered text, tool-use line,
  thinking marker, etc.) for the chunk they just consumed.
- When the one-shot fires: emit
  `⏳ reviewer running — <elapsed>s elapsed\n` via `onHeartbeat`
  (default sink: `process.stderr`), then re-arm the one-shot for
  `now + 30_000` ms.
- On `child.close`, `child.error`, and the timeout path: cancel the
  pending one-shot.
- Heartbeat lines are not duplicated into the reviewer log (the log
  footer carries elapsed time; tick noise would clutter it).

The "user-visible" gating closes the loophole where a child streams
chunks the policy chooses not to render (e.g. stream-json thinking
blocks, partial-line tail buffering). In that case the watchdog still
fires after 30s of silence even though the child was technically
producing bytes — which is what the user wants, since they see
nothing.

This collapses the worst-case silent stretch to exactly the heartbeat
period. With a 30s period, the user sees a heartbeat at most 30s after
the last byte of activity.

**Concrete schedule example** (single child, heartbeat period = 30s,
child emits one stdout chunk at t=10s, then stays silent and closes at
t=65s):

| t (s) | Event                      | one-shot armed for | fires? | rendered                            |
|------:|----------------------------|-------------------:|:------:|-------------------------------------|
|     0 | spawn                      |                30s | —      | —                                   |
|    10 | child writes one stdout    |                40s | —      | (previous one-shot at 30s cancelled)|
|    40 | one-shot fires             |                70s | yes    | `⏳ reviewer running — 40s elapsed` |
|    65 | child close                |        — (cleared) | —      | (one-shot at 70s cancelled)         |

So a child that emits at t=10s and stays silent until t=65s yields
**exactly one** heartbeat line at t=40s with elapsed=40s — i.e. exactly
30s after the last activity, satisfying the ≤30s silence guarantee.
Test 1 in the test plan reflects this schedule.

#### Testability seam

Extract `src/utils/reviewer-runner.js` (new) as a **purely mechanical**
helper: it owns child spawning, the timeout timer, the heartbeat
interval, chunk dispatch to handler callbacks, and the capped stdout
buffer. It does **not** know about log files, header/footer formatting,
salvage, or verdict parsing.

`runSingleReviewer` (policy layer) keeps everything else: config loading,
preflight, opening the log stream, writing the header, building handlers
(plain in text mode, stream-json transformer-aware in stream-json mode),
running salvage, parsing the verdict, and finally writing the footer and
closing log + sidecar streams.

This split is what makes both runner-boundary issues work:

- **Footer ordering:** the runner does *not* touch the log. Policy
  writes the header before calling the runner and writes the footer
  *after* salvage + verdict parsing, so the footer's `Verdict:` line
  can record `approved | needs-changes | missing | salvaged:<verdict>`.
- **Stream-json swap:** stdout handling is a callback the runner
  invokes per chunk. In text mode the callback writes to
  `process.stdout` and to the log; in stream-json mode the callback is
  a closure that feeds chunks through the JSONL translator (rendered
  lines → process.stdout + log) and tees raw chunks to a sidecar file
  the policy opened. The runner never sees the difference.

**Process termination semantics (preserved verbatim from today's
`runSingleReviewer`).** The runner is the only owner of child lifecycle,
so it must replicate the existing guarantees:

- The child is spawned via `spawn('bash', ['-c', command], { ...,
  detached: true, stdio: ['ignore', 'pipe', 'pipe'] })`. `detached:
  true` puts the shell into its own process group whose pgid equals
  the shell's pid.
- On timeout: the runner calls `process.kill(-child.pid, 'SIGTERM')`
  (negative pid = whole process group), then schedules a one-shot
  `setTimeout` for a 5s grace period (`REVIEWER_TERMINATION_GRACE_MS`,
  promoted to a runner constant). When the grace timer fires, it calls
  `process.kill(-child.pid, 'SIGKILL')`. Both kill calls are wrapped in
  try/catch so a race against natural exit is benign.
- The grace timer is cleared on `child.close` if the child exits before
  it fires.
- The runner resolves with `{ exitCode: null, timedOut: true, ... }`
  the moment SIGTERM is sent (consistent with current behavior — the
  user's CLI doesn't wait for the grace window).
- The same group-kill logic applies on `child.error` after a partial
  spawn (best-effort).

These are runner invariants, not policy invariants. Any reviewer
config — including shell pipelines that fork grandchildren — therefore
gets its full process group killed on timeout, not just the leading
shell.

`runReviewerProcess(options)` signature:

```js
runReviewerProcess({
  command,            // string passed to `bash -c`
  cwd, env,           // child spawn options
  timeoutMs,          // hard kill deadline
  heartbeatMs,        // 30_000 in production
  onStdout,           // (chunk, ctx) => void  ctx = { markActivity() }
  onStderr,           // (chunk, ctx) => void  ctx = { markActivity() }
  onHeartbeat,        // (elapsedMs) => void  (default: write "⏳ … Ts elapsed\n" to process.stderr)
  stdoutBufferLimit,  // 2 MiB default; runner returns the captured buffer for salvage
  // injectables (defaulted to real implementations):
  spawn, now, setTimeout, clearTimeout,
}) -> Promise<{
  exitCode, timedOut, startedAt, endedAt, elapsedMs, stdoutBuffer
}>
```

Notes:
- The watchdog's `lastActivityAt` is updated **only** when a handler
  invokes the `markActivity()` callback the runner passes in `ctx`.
  Handlers must call `markActivity()` iff they emitted at least one
  user-visible line for the chunk they just consumed. The runner does
  not auto-rearm on raw chunk arrival. This is the silence-guarantee
  fix: a child that writes only partial JSON or thinking-only events
  (which the stream-json translator collapses to a single visible
  marker — see §4) cannot suppress the heartbeat past 30s of unbroken
  invisibility.

  In **text mode**, the default `onStdout`/`onStderr` write the chunk
  verbatim to `process.stdout`/`process.stderr` and the log, then call
  `markActivity()` for any non-empty chunk.

  In **stream-json mode**, the translator's `onStdout` calls
  `markActivity()` only when at least one rendered line was emitted to
  the human sinks during that chunk. Mid-line buffering (a chunk that
  doesn't complete an event yet) does **not** mark activity.
- The runner returns `startedAt` and `endedAt` as ISO 8601 strings so
  the policy footer can render them verbatim without a second clock
  call.
- The runner's stdout buffer captures **raw** bytes (capped). In
  stream-json mode the buffer therefore holds raw JSONL; salvage is
  disabled in that mode (§3 already states this), so buffer contents
  are forensic only.

#### End-of-run sequence (policy)

After `runReviewerProcess` resolves, `runSingleReviewer` performs:

1. If `onStdout`/`onStderr` was a stream-json closure, flush its
   partial-line tail.
2. Read `feedbackPath`. If `## Round <expected>` is present → use the
   parsed verdict.
3. Else if **not** in stream-json mode, attempt strict salvage from the
   returned `stdoutBuffer` (§3). On success, the feedback file gets the
   `<!-- salvaged from stdout -->` block; re-read and parse.
4. Compute `verdictForFooter` ∈ `{approved, needs-changes, missing,
   salvaged:<verdict>}`.
5. Write the log footer (Ended/Elapsed/Exit code/Timed out/Verdict).
6. Close the log stream and the stream-json sidecar (if any).
7. Return the verdict to the chain runner.

In tests we substitute the runner's injectables:
- `spawn` → returns a fake child (an `EventEmitter` with `stdout`/`stderr`
  sub-emitters, `pid`, and a no-op `kill`) that the test drives by
  emitting `data`/`close` events at chosen virtual times.
- `now` / `setTimeout` / `clearTimeout` → backed by a
  manually-advanced fake clock (`clock.tick(ms)` walks scheduled
  callbacks deterministically). The heartbeat watchdog and the
  hard-kill timeout both ride on the same `setTimeout` injectable.
- `onStdout`/`onStderr`/`onHeartbeat` → array collectors so assertions
  inspect counts and contents.

For policy-level tests (footer ordering, salvage interaction), we
substitute `runReviewerProcess` itself with a stub that resolves with a
canned `{ exitCode, stdoutBuffer, … }`, letting us assert that the
footer is written *after* the feedback file is mutated by salvage.

### 2. Reviewer-log header and footer

Header (written before spawn, replaces the current banner):

```
Reviewloop reviewer log
Reviewer:   <name>
Phase:      <phase>
Round:      <round>
Started:    <ISO 8601>
Timeout:    <seconds>s
Command:    <config.command>
Env:
  SPECDEV_PHASE=<...>
  SPECDEV_ASSIGNMENT=<...>
  SPECDEV_ROUND=<...>
  SPECDEV_FEEDBACK_FILE=<...>
  SPECDEV_CHANGELOG_FILE=<...>
  SPECDEV_FOCUS=<one-line truncated>
  SPECDEV_DISCUSSION=<... if set>

----- reviewer output -----
```

Footer (appended after `child.close` or timeout, before `closeLog`):

```
----- end of reviewer output -----
Ended:      <ISO 8601>
Elapsed:    <seconds>s
Exit code:  <code | null if killed>
Timed out:  <true|false>
Verdict:    <approved | needs-changes | missing | salvaged:<verdict>>
```

`Verdict:` is computed *after* the salvage step (§3) so the footer
reflects the final state the user sees.

### 3. Strict stdout salvage

Triggered when: child exited with code `0` AND the feedback file does
**not** contain `## Round <expected>`.

Salvage rules (strict only — no lenient mode):

1. Read child stdout buffer (we already pipe to log; also keep an
   in-memory buffer capped at, e.g., 2 MiB; oldest bytes evicted).
2. Find the regex `/^## Round (\d+)\b/m` whose captured number equals
   the expected round.
3. Slice from that match to end-of-buffer.
4. The slice must contain
   `/^\*\*Verdict:\*\*\s+(approved|needs-changes)\b/m`. If not, salvage
   fails.
5. On success: append to the feedback file as

   ```
   <!-- salvaged from stdout (reviewer exited cleanly without writing) -->
   <slice>
   ```

   then re-read the file and continue the normal verdict path. The log
   footer records `Verdict: salvaged:<verdict>`.
6. On failure: fail with the current diagnosis message, plus point at
   the log path; footer records `Verdict: missing`.

Salvage is **off** when stream-json mode is active (§4) — in that mode
the assistant's final text is emitted as a structured event and is not
guaranteed to be a verbatim copy of any feedback file content.

### 4. Claude stream-json translator

`templates/.specdev/skills/core/reviewloop/reviewers/claude.json` becomes:

```
claude --model 'claude-opus-4-6[1m]' --fallback-model sonnet \
       --effort high --print \
       --output-format stream-json --verbose \
       --no-session-persistence \
       --dangerously-skip-permissions --permission-mode bypassPermissions \
       "<existing prompt>"
```

Reviewloop detects stream-json in two ways (either is sufficient):

- The reviewer config has an optional `"stream_json": true` field, OR
- The resolved command contains `--output-format stream-json`.

When detected, child stdout is fed line-by-line to a translator
(`src/utils/reviewer-stream-json.js`, new) that converts JSONL events to
human-readable progress lines:

| Event                                          | Rendered as                                               |
|------------------------------------------------|-----------------------------------------------------------|
| `{type:"system", subtype:"init"}`              | `▸ session start (model=<m>)`                             |
| `{type:"assistant", message.content[].text}`   | append text verbatim                                      |
| `{type:"assistant", …content[].thinking}`      | `🤔 thinking…` (one collapsed line per thinking block; chain-of-thought content is **not** rendered) |
| `{type:"assistant", …content[].tool_use}`      | `▸ tool: <name>(<args summary, ≤80 chars>)`              |
| `{type:"user", …content[].tool_result}`        | `  ↳ tool ok` / `  ↳ tool error: <truncated>`             |
| `{type:"result", subtype:"success"}`           | `▸ done (<duration_ms>ms, <num_turns> turns)`             |
| `{type:"result", subtype:"error_*"}`           | `▸ error: <subtype>`                                      |
| Non-JSON line                                  | passed through verbatim                                   |
| Malformed JSON                                 | passed through verbatim                                   |

Translator behavior:

- Splits on `\n`; carries a partial-line tail across chunks.
- Writes rendered lines to **both** stdout (user-visible) and the
  reviewer log (so the log is human-readable, not raw JSONL).
- Also writes the raw JSONL to a sibling file
  `<feedbackPhase>-reviewer-<name>-round-<r>.jsonl` for forensic use.
- `lastStdoutAt` is updated whenever the translator emits a rendered
  line, so the heartbeat suppresses naturally during active tool use.

Thinking-block **content** (chain-of-thought) is deliberately not
rendered — only a single collapsed `🤔 thinking…` marker per thinking
block is emitted. This serves two purposes: (a) the user sees that the
model is actively thinking during what would otherwise be a silent
stretch, and (b) it counts as user-visible activity for the watchdog
rearm semantics in §1, so a thinking-heavy turn cannot trick the
heartbeat into silence.

### 5. Reviewer-name validation and safe path construction

A new finding during review noted that today's reviewloop treats
`--reviewer=<name>` as free-form input: config lookup and the
multi-reviewer feedback/changelog filenames interpolate the raw name
without validation; only the log filename is sanitized
(`SAFE_LOG_NAME_PATTERN` in `src/commands/reviewloop.js`). Adding the
new stream-json sidecar would replicate the same vulnerable pattern.

This assignment fixes the issue everywhere it appears, so the new
sidecar is the *last* path-interpolation site to be added, not another
one to harden later.

Rules:

1. **Allowed shape.** Reviewer names must match
   `^[A-Za-z0-9._-]+$`. Names that fail this regex are rejected
   up-front, before any path is constructed, with the message
   `Invalid reviewer name: "<input>" (allowed: A–Z, a–z, 0–9, dot,
   underscore, hyphen)`.
2. **Must exist.** Each name must correspond to an existing
   `<name>.json` file in `<.specdev>/skills/core/reviewloop/reviewers/`.
   The list of available reviewers is enumerated by reading that
   directory; any `--reviewer=<name>` not in the enumerated set is
   rejected with `Reviewer config not found: <name>` plus the same
   "Available reviewers: …" listing the no-`--reviewer` path already
   prints.
3. **Resolved safe name is the single source of truth.** A new
   helper `resolveReviewerNames(specdevPath, rawList)` (in
   `src/utils/reviewer-preflight.js`, alongside the existing
   preflight) takes the comma-split raw list, applies rules 1 and 2,
   and returns the list of validated names verbatim (we do not
   normalise case or rewrite separators — we either accept or reject).
4. **All path construction uses the resolved name** without further
   regex-replacing. Sites updated:
   - `reviewerLogPath` (already sanitized — keep, but remove the
     fallback regex since names are now pre-validated).
   - `runReviewerChain`'s `feedbackFilename` and `changelogFilename`
     interpolation (`brainstorm-feedback-<name>.md`,
     `brainstorm-changelog-<name>.md`).
   - The config lookup `join(..., \`${reviewerName}.json\`)` in both
     `runSingleReviewer` and `preflightReviewers`.
   - The new stream-json sidecar
     `<feedbackPhase>-reviewer-<name>-round-<r>.jsonl`.

This is treated as scope of *this* assignment because the new sidecar
makes the existing latent issue worse if left unaddressed.

### 6. Per-reviewer timeout override

In `src/utils/reviewer-preflight.js#reviewerTimeoutSeconds` (existing):

- If `process.env.SPECDEV_REVIEWER_TIMEOUT` is set and parses as a
  positive integer, return that value.
- Else fall back to `config.timeout_seconds`, then the existing default.

Documented in `templates/.specdev/skills/core/reviewloop/reviewers/README.md`.

### 7. Numbering note

The previous edit renumbered §5 to "Reviewer-name validation" and bumped
the timeout override to §6. The original §6 placeholder is retired; this
§7 exists only to flag the renumbering for readers diffing across rounds.

### File-by-file plan

| File                                                                              | Change                                                                                       |
|-----------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `src/commands/reviewloop.js`                                                      | Open log + write header; build stdout/stderr handlers (plain or stream-json closure); call `runReviewerProcess`; run salvage; write footer; close log + sidecar. |
| `src/utils/reviewer-runner.js` *(new)*                                            | Mechanical only: child spawn + timeout + heartbeat (with injectable clock/timers) + chunk dispatch to handlers + capped stdout buffer. No log/file knowledge. |
| `src/utils/reviewer-stream-json.js` *(new)*                                       | JSONL translator factory: returns a `{ onStdout, flush }` closure that renders events to the human log/stdout sinks and tees raw chunks to a caller-provided sidecar stream. |
| `src/utils/reviewer-preflight.js`                                                 | Honor `SPECDEV_REVIEWER_TIMEOUT`; add `resolveReviewerNames(specdevPath, rawList)` validating shape `^[A-Za-z0-9._-]+$` and existence in reviewers/. |
| `templates/.specdev/skills/core/reviewloop/reviewers/claude.json`                 | Add `--output-format stream-json --verbose`; optional `"stream_json": true` for clarity.     |
| `templates/.specdev/skills/core/reviewloop/reviewers/README.md`                   | Document heartbeat, stream-json mode, salvage marker, `SPECDEV_REVIEWER_TIMEOUT`.            |
| `tests/test-reviewloop.js`                                                        | Add cases: heartbeat suppression on active stdout; salvage success + failure; log footer.    |
| `tests/test-reviewloop-stream-json.js` *(new)*                                    | Translator unit tests over a fixture JSONL stream (golden output).                            |
| `package.json`                                                                    | Bump `releaseDate` to current date on commit (per CLAUDE.md).                                |

### Risk and rollback

- Stream-json is a behavior change for the Claude reviewer config. If
  the translator regresses, users can revert `claude.json` to remove
  `--output-format stream-json --verbose` and the code path falls back
  to today's text-mode handling automatically (translator is gated on
  detection).
- Heartbeat is purely additive on stderr; no parsers depend on stderr
  contents.
- Salvage only mutates the feedback file when the strict pattern is
  found; otherwise it's a pure failure path identical to today.

## Success Criteria

0. Reviewer names from `--reviewer=…` are validated against
   `^[A-Za-z0-9._-]+$` *and* the actual `*.json` files in
   `.specdev/skills/core/reviewloop/reviewers/` before any path is
   constructed; an invalid or unknown name fails fast with a clear
   message and produces no filesystem writes.
1. During a real Claude reviewer run, the user sees readable progress
   (session init, tool calls, assistant text) within the first ~30s and
   continuously thereafter — no more than 30s of silence at any point.
2. Any reviewer (Claude or otherwise) that goes silent for >30s produces
   a heartbeat line on stderr without polluting stdout.
3. The reviewer log file contains a header with Started/Env and a footer
   with Ended/Elapsed/Exit code/Timed out/Verdict. Reading the log alone
   answers "when did it run, how long, how did it end, and what's the
   verdict?".
4. When a reviewer exits 0 without writing the feedback file but stdout
   contains a strict `## Round N` + `**Verdict:** …` block, the feedback
   file is appended with a `<!-- salvaged from stdout -->` marker and
   the run continues normally. Footer records `salvaged:<verdict>`.
5. When the strict pattern is absent, the run fails with the existing
   diagnosis message; the feedback file is not modified.
6. `SPECDEV_REVIEWER_TIMEOUT=N` overrides `config.timeout_seconds` for a
   single run; default behavior is unchanged when the env var is unset.
7. All test plan cases (§Test plan below) pass under `npm test`.

### Test plan

Unit/integration (under `tests/`):

1. **Heartbeat watchdog rearm** — drive `runReviewerProcess` with a
   fake spawn and fake clock. Fake child emits one stdout chunk at
   virtual t=10s, then stays silent and closes with exit 0 at virtual
   t=65s. Advance the fake clock through t=30s, t=40s, t=65s. Assert:
   - At t=30s, **no** heartbeat fires (the t=30s one-shot was
     cancelled and rearmed for t=40s when the child wrote at t=10s).
   - At t=40s, **exactly one** heartbeat call is captured by the
     `onHeartbeat` collector with `elapsedMs === 40_000` and rendered
     text `⏳ reviewer running — 40s elapsed`.
   - At t=65s, the child closes and the rearmed one-shot for t=70s is
     cancelled — no further heartbeats.

   Total: exactly one heartbeat, exactly 30s after the last activity.
   No real-time waits.
2. **Salvage success** — fake child writes to stdout the strict pattern
   for the expected round and exits 0 without touching the feedback
   file; assert feedback file gets the `<!-- salvaged … -->` marker plus
   the round, verdict path returns the salvaged verdict, footer records
   `salvaged:<verdict>`.
3. **Salvage failure** — fake child stdout has `## Round 2` only
   (off-by-one round) or no verdict line; assert no feedback-file
   mutation, error path with current message, footer records `missing`.
4. **Log header/footer present** — run a no-op reviewer; assert header
   has Started/Env block; footer has Ended/Elapsed/Exit/Timed out/Verdict.
5. **Footer is written after salvage** — stub `runReviewerProcess` to
   resolve with a `stdoutBuffer` containing the strict salvage pattern
   and an empty feedback file. Assert (a) the feedback file is mutated
   with the `<!-- salvaged from stdout -->` block, (b) the log footer
   is then written with `Verdict: salvaged:<verdict>`, and (c) byte
   ordering in the log file shows the footer appearing *after* the
   final raw output and after the feedback file's mtime.
6. **Stream-json translator** — feed a fixture JSONL stream into the
   translator's `onStdout`; assert rendered lines match the golden
   file; ensure non-JSON lines pass through; ensure chunks split
   mid-line reassemble; assert raw chunks are written verbatim to the
   provided sidecar stream. **Activity-marking sub-cases:**
   (a) feeding a complete `assistant.thinking` event invokes
   `markActivity()` exactly once and emits one `🤔 thinking…` line;
   (b) feeding a chunk that contains only the first half of a JSON
   line (mid-line buffering) emits no rendered line *and* does not
   invoke `markActivity()`; (c) the second half completing the line
   then renders + marks activity once.
7. **Timeout override** — set `SPECDEV_REVIEWER_TIMEOUT=2`; spawn a
   sleeping child; assert the run times out at ~2s and the footer
   records `Timed out: true`.
8. **Heartbeat under invisible-only chunks** — wire `runReviewerProcess`
   to a handler that *never* calls `markActivity()` (simulates a
   reviewer streaming only chunks the policy refuses to render — e.g.
   partial-line tail or hypothetical unrendered event types). Drive a
   fake child that emits a stdout chunk every 5s for 90s. Assert the
   watchdog still fires three heartbeats (at virtual t=30s, t=60s,
   t=90s), proving the silence guarantee is independent of raw chunk
   arrival when no user-visible output is produced.
9. **Timeout kills the whole process group** *(real spawn — this test
   exercises OS-level semantics that fakes can't validate)*. Run
   `runReviewerProcess` with `command = "bash -c 'sleep 30 & echo
   \"grandchild_pid=$!\"; wait'"` and `timeoutMs = 1000`. Capture
   the grandchild PID from stdout. After the runner resolves with
   `timedOut: true`, wait briefly (e.g. 200ms past the 5s grace) then
   assert `process.kill(grandchildPid, 0)` throws `ESRCH` — proving the
   grandchild was reaped via the process-group SIGTERM/SIGKILL, not
   left orphaned. Skip on platforms where `spawn` does not support
   `detached: true` cleanly (none today; document the assumption).
10. **Reviewer name validation** — call `resolveReviewerNames` with
   each of `../foo`, `foo/bar`, `foo bar`, `` (empty),
   `nonexistent`, and `claude` (assuming `claude.json` exists). Assert
   the first four are rejected with the `Invalid reviewer name`
   message and never touch the filesystem; `nonexistent` is rejected
   with `Reviewer config not found`; `claude` is accepted. Assert no
   filesystem read occurs outside `<.specdev>/skills/core/reviewloop/reviewers/`
   (verify via a fake `fs` that records all paths read).

Manual smoke (post-merge, optional): rerun the real Claude reviewer end
to end on a small assignment and confirm progress lines flow during
thinking + tool use.
