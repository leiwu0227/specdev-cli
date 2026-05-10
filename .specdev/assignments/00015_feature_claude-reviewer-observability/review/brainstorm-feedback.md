## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] The heartbeat behavior is not yet designed through a testable integration seam. The design requires a fake child and injectable clock/interval for the heartbeat test, but the current code keeps `runSingleReviewer` private in `src/commands/reviewloop.js` and directly owns `spawn`, timers, stdout/stderr wiring, log lifecycle, and verdict parsing. The current reviewloop tests in `tests/test-reviewloop-command.js` run the CLI as a subprocess with a 30s timeout, so implementing the proposed "prints at t=10s and stays silent until t=70s" test literally would either require real-time waits longer than the test timeout or an unplanned refactor. The heartbeat timing expectation is also internally inconsistent: with a fixed 30s interval and output at t=10s, the first eligible tick is t=60s, not t=40s, and a child ending at t=70s would normally produce one heartbeat, not exactly two. Please specify the implementation seam, such as extracting a small reviewer-runner helper that accepts `spawn`, clock, interval, stdout/stderr sinks, and log sinks, or adding a documented test-only heartbeat interval control, and reconcile the expected heartbeat schedule with the actual timer model.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] The new `reviewer-runner` boundary still cannot implement two required outcomes as written. The design says `src/utils/reviewer-runner.js` owns child spawning, stdout/stderr wiring, log header/footer writing, and log close, while `runSingleReviewer` keeps policy such as salvage and verdict parsing. In the current code, the child lifecycle/log stream closes before feedback parsing happens (`src/commands/reviewloop.js` currently closes the log on child close, then reads `brainstorm-feedback.md` and determines the verdict). The proposed design keeps that policy split, but also requires the footer's `Verdict:` to be computed after strict stdout salvage and to record `salvaged:<verdict>` or `missing`. That cannot work if the runner has already written and closed the footer before policy-layer salvage/parsing runs. The same boundary gap affects stream-json: the proposed `runReviewerProcess(options)` signature has stdout/stderr sinks and a log sink, but no stdout transformer/raw sidecar hook, while the design requires stream-json stdout to be translated to human-readable stdout/log output and raw JSONL to be written to a sibling `.jsonl` file. Please revise the seam so policy can finalize the log after verdict/salvage, and so stdout handling can be swapped for stream-json mode without duplicating raw JSON into the human log.

### Addressed from changelog
- [F1.1] Addressed. The design now extracts a testable `reviewer-runner` helper with injectable spawn/clock/timers/sinks and reconciles the heartbeat schedule to exactly one heartbeat at t=60s for the t=10s/t=70s example.

## Round 3

**Verdict:** needs-changes

### Findings
1. [F3.1] The heartbeat design still does not satisfy its stated observability guarantee. The proposed runner uses a fixed 30s `setInterval` and only emits when the current tick sees `now - lastStdoutAt >= 30_000` (`brainstorm/design.md` lines 69-74). The design's own example proves this can leave a 50s quiet period after child output at t=10s before the next heartbeat at t=60s (`brainstorm/design.md` lines 84-90), yet success criterion 1 promises "no more than 30s of silence at any point" (`brainstorm/design.md` lines 340-342). This is a real user-visible mismatch for the core problem being solved: a reviewer that writes just after a tick can remain silent for almost 60s while still implementing the proposed algorithm and passing Test 1. Please either change the heartbeat scheduling to enforce a max-silence guarantee, such as rescheduling a one-shot timer for 30s after each activity event, or relax the success criteria and test expectations to the actual fixed-interval behavior.

### Addressed from changelog
- [F2.1] Addressed. The runner is now purely mechanical, policy owns log header/footer and post-salvage verdict computation, and stream-json handling is a policy-provided stdout callback with a raw sidecar stream.

## Round 4

**Verdict:** needs-changes

### Findings
1. [F4.1] The design adds a new reviewer-name-derived sidecar artifact but still does not specify reviewer-name validation or safe path construction. Current `reviewloop` treats `--reviewer` as free-form CLI input, splits it directly into `reviewerNames` (`src/commands/reviewloop.js:531`), loads configs with `join(..., \`${reviewerName}.json\`)` (`src/commands/reviewloop.js:97`, mirrored in `src/utils/reviewer-preflight.js:30-36`), and only sanitizes the log filename through `reviewerLogPath` (`src/commands/reviewloop.js:57-60`). Multi-reviewer feedback/changelog filenames still interpolate the raw name (`src/commands/reviewloop.js:293-298`). The proposed stream-json sidecar repeats that pattern as `<feedbackPhase>-reviewer-<name>-round-<r>.jsonl` (`brainstorm/design.md`, stream-json translator section), but the design never says whether `<name>` is sanitized, basename-only, or resolved from the actual config list. This is a real input-validation risk under the review focus: a reviewer name containing `/` or `..` can make config lookup and generated artifact paths resolve outside the intended `reviewers/` or `review/` locations, and the new sidecar gives implementation one more path to get wrong. Please add an explicit rule and tests that reviewer names must match available reviewer config basenames, e.g. a conservative `^[A-Za-z0-9._-]+$`, and use the same sanitized/resolved safe name for log, sidecar, reviewer-specific feedback, and changelog files.

### Addressed from changelog
- [F3.1] Addressed. The heartbeat algorithm is now a re-armed one-shot watchdog, and the schedule/test expectations match the stated <=30s silence guarantee.

## Round 5

**Verdict:** needs-changes

### Findings
1. [F5.1] The stream-json heartbeat path can still violate the user-visible "no more than 30s of silence" guarantee, and the test plan would not catch it. The runner currently resets its heartbeat whenever it delivers any stdout/stderr chunk to the policy callback, "even if the rendered output is empty" (`brainstorm/design.md` lines 151-157), while the stream-json translator deliberately does not render thinking blocks (`brainstorm/design.md` lines 311-313). That means a real Claude run that emits unrendered stream-json events or partial JSON chunks every few seconds can suppress the heartbeat indefinitely while producing no stdout/log progress for the user, contradicting Success Criterion 1 (`brainstorm/design.md` lines 412-414). The proposed translator test only checks rendered fixtures, chunk reassembly, and raw sidecar writes (`brainstorm/design.md` lines 466-470); it does not exercise "child is active but policy renders nothing." Please specify whether heartbeat activity is based on child bytes or user-visible output, and add a test for stream-json chunks/events that render no visible line. A reasonable fix is to have `onStdout` report whether it emitted user-visible output so the runner only rearms the silence watchdog on visible activity, or to render a collapsed progress line for otherwise-silent Claude event classes.

### Addressed from changelog
- [F4.1] Addressed. The design now adds reviewer-name validation, resolves names against actual reviewer config basenames, routes all reviewer-derived artifact paths through the validated name, and adds a dedicated validation test.

## Round 6

**Verdict:** needs-changes

### Findings
1. [F6.1] The extracted runner does not specify how it preserves the current timeout termination semantics for shell-spawned reviewer commands. Today `runSingleReviewer` launches `bash -c <command>` with `detached: true` and, on timeout, sends `SIGTERM` and then `SIGKILL` to the negative child pid so the whole process group is terminated (`src/commands/reviewloop.js:189-207`). The design moves spawning and timeout ownership into `src/utils/reviewer-runner.js`, but the proposed `runReviewerProcess` contract only says `command // string passed to bash -c`, `timeoutMs // hard kill deadline`, and injectable `spawn/setTimeout/clearTimeout`; it does not say to spawn detached, kill the process group, preserve the grace-period kill, or test that a grandchild such as `bash -c "sleep 60"` is actually gone after timeout. That is a real reliability regression for reviewloop because reviewer configs are arbitrary shell commands and may launch child processes; killing only the shell can leave the expensive reviewer process running in the background while reviewloop reports a timeout. Please make process-group termination and the existing SIGTERM→SIGKILL grace behavior explicit in the runner design, and add a test that verifies timeout cleanup for a shell command with a child process.

### Addressed from changelog
- [F5.1] Addressed. The runner now only rearms the silence watchdog when the policy callback marks user-visible activity, the stream-json translator renders collapsed thinking markers, and the test plan covers invisible-only chunks plus partial-line buffering that must not mark activity.

## Round 7

**Verdict:** approved

### Findings
- (none)

### Addressed from changelog
- [F6.1] Addressed. The design now makes detached shell spawning, process-group SIGTERM/SIGKILL cleanup, the 5s grace timer, and timeout resolution semantics explicit runner invariants, with a real-spawn integration test for a shell command that leaves a grandchild process.
