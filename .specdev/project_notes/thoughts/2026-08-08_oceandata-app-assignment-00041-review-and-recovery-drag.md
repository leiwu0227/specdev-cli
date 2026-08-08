# OceanData App Assignment 00041 review and recovery drag

**Date:** 2026-08-08  
**Observed in:** `oceandata_app` Assignment 00041  
**Assignment delivery:** `96e0e7ec1d9f8f4ae259fa11357d3fa23817f434`  
**Receipt repair:** `82cf83e02fb2eba0b013f85987f29e21b761dce0`  
**Installed SpecDev:** `0.0.4`, release date `2026-08-04`  
**Compared with specdev-cli:** `1c25b65f05b7d4b8a53110973081a43c03143db9`
(`0.0.4`, release date `2026-08-08`)  
**Status:** live-test feedback for SpecDev maintainers

## Context

Assignment 00041 adopted OceanData's clean-break versioned source/sanitizer
contracts and expanded the OceanData App command transport. The substantive
delivery was successful:

- all three acceptance criteria passed;
- four verification receipts passed;
- 117 focused tests passed;
- the required Claude Fable implementation review approved;
- the final product delivery contained 17 project paths; and
- OceanData and oceandata_tau remained unmodified.

The workflow still had significant operator drag around changing a Brainstorm
reviewer, interrupting the incorrectly selected reviewer, recovering its stale
Attempt record, completing terminal compaction, and interpreting an incomplete
receipt produced after the Assignment was already marked complete.

The receipt/finalization issue appears already addressed in current
specdev-cli main by Assignment 00046. The reviewer-profile and stale-Attempt
recovery problems remain visible in current source and are the most important
new findings from this run.

## Executive summary

The two highest-priority open issues are:

1. A Brainstorm review profile is silently frozen in
   `review/brainstorm-state.json`. Changing `.specdev/cache/agents.local.yaml`
   does not change the reviewer for a later contract revision, and there is no
   supported command to request a fresh review profile.
2. Interrupting the wrongly selected reviewer left a durable Attempt with
   `status: running` and a stale PID marker. `specdev status` diagnosed it as
   stale/interrupted, but no public recovery action existed. Much later, after
   implementation review approved and the Assignment was marked completed,
   terminal compaction failed on that old Attempt.

The observed failure chain was:

```text
Brainstorm reviewed by Opus
  -> local reviewer changed to Fable/high
  -> amended contract review still launches saved Opus/xhigh
  -> foreground interrupts wrong reviewer
  -> Attempt-00119 remains durably "running"
  -> worker completes
  -> Fable implementation review approves
  -> Assignment status becomes completed
  -> terminal compaction rejects Attempt-00119
  -> no public recovery command
  -> internal process-record API used manually
  -> rerun `specdev implement`
  -> delivery finally commits
```

This is recoverable, but it requires implementation knowledge that normal
SpecDev users should not need.

## What worked well

### Exact contract approval and acceptance evidence were useful

The contract clearly separated source v2/v3/v4 documents from generator v1,
pinned the new commands, preserved the legacy route deliberately, and forbade
external dataset writes. The worker and reviewer both used that authority
effectively.

### Automatic implementation review selected the requested profile

The new implementation-review state correctly resolved the current local
reviewer configuration and launched Claude Fable at high effort. The profile
problem was specific to reusing an existing Brainstorm review state.

### Completion was idempotently recoverable

After the stale Attempt was repaired, rerunning `specdev implement` detected
the completed Assignment, resumed terminal delivery, compacted runtime state,
and created one delivery commit. This recovery path is a strong foundation;
the missing piece is a supported way to reconcile the stale Attempt first.

### Current main already improves receipt safety and semantic progress

specdev-cli Assignment 00046 added candidate-receipt preflight, reviewed
candidate identity, canonical outcome validation, legacy risk normalization,
and bounded semantic Attempt milestones. Those changes directly address two
sources of drag observed with the globally installed 2026-08-04 build.

## Finding 1: reviewer profile is silently frozen across contract revisions

### Observed behavior

The initial Brainstorm review used Claude Opus/xhigh. The requested reviewer was
later changed to Claude Fable/high in the ignored local profile:

```yaml
reviewer:
  provider: claude
  model: fable
  effort: high
```

Rerunning `specdev reviewloop brainstorm` on an unchanged approved contract
returned the previous Opus verdict immediately. That cache behavior is
reasonable for the same review identity, but the output did not explain that a
newly configured reviewer had not run.

After the contract was amended and checkpointed, rerunning the review launched
Opus/xhigh again. Current source explains why:

```js
async function reviewProfile(specdevPath, flags, saved) {
  return resolveAgentProfile(
    specdevPath,
    'reviewer',
    saved ? { ...saved, timeout: saved.timeout_ms } : profileOverrides(flags)
  )
}
```

Once `reviewState.profile` exists, it has explicit-precedence over repository
and local configuration. A contract revision resets the review round/status
but preserves the saved profile. Even the diagnostic provider/model/effort
flags cannot override it because `profileOverrides(flags)` is not consulted
when `saved` exists.

The user explicitly requested Fable, so the only safe route available was a
native read-only Claude session. That review was necessarily advisory and
could not produce a SpecDev transition-authorizing result.

### Why this is drag

- The configured reviewer and the actual reviewer disagree silently.
- A user cannot request a second opinion on the same contract hash.
- A materially amended contract cannot naturally pick up the current reviewer
  policy.
- The only apparent workarounds are manually editing durable review state,
  creating a new Assignment, or bypassing SpecDev with an advisory review.
- Starting the wrong paid/high-effort provider wastes time and money before the
  mismatch is visible.

### Proposed fix

Treat review identity as an explicit tuple:

```text
contract hash
+ reviewer provider/model/effort
+ selected review guides
+ review mode/schema version
```

Recommended behavior:

1. If the exact tuple is already approved, return the cached verdict and print
   `cached review reused` with the saved profile.
2. If the contract hash changes and configured reviewer identity changes,
   start a new round with the configured profile while retaining prior rounds
   as history.
3. If the contract hash is unchanged but the user wants a second opinion,
   provide an explicit audited command such as:

   ```sh
   specdev reviewloop brainstorm --rerun
   specdev reviewloop brainstorm --refresh-profile
   ```

4. Before spawning, always print the resolved provider/model/effort and whether
   it came from saved state, repository config, local config, or flags.
5. If profile freezing is intentional for convergence, make it a documented
   policy and provide a supported `review profile replace` transition rather
   than requiring state-file surgery.

The prior verdict should remain durable; changing reviewer identity should add
a round, not overwrite history.

## Finding 2: interrupted reviewers can remain durably running

### Observed behavior

The wrong Opus Brainstorm reviewer was interrupted with Ctrl-C immediately
after its profile was shown. Its durable record remained:

```yaml
id: Attempt-00119
kind: reviewer
status: running
provider: claude
model: opus
effort: xhigh
```

The ignored marker still contained a dead PID. `specdev status --json` later
reported:

```json
{
  "lifecycle": "interrupted",
  "attempt": {
    "id": "Attempt-00119",
    "role": "reviewer",
    "status": "interrupted",
    "liveness": "stale"
  },
  "blocker": "Attempt Attempt-00119 has stale process liveness; inspect it before takeover.",
  "next_action": { "command_line": "specdev do \"<intent>\"" }
}
```

The diagnosis was correct, but the durable YAML was not reconciled and the
suggested next action could not repair it.

After worker Attempt-00120 and Fable reviewer Attempt-00121 both finished, the
Assignment reached completed status. Terminal compaction then threw:

```text
Error: cannot compact runtime with running Attempts: Attempt-00119
    at compactTerminalWorkflowRuntime (.../artifact-retention.js:129)
```

The only successful recovery found was to import SpecDev's internal
`updateAttemptRecord()` and `clearLocalProcessMarker()` functions from a Node
one-liner, mark Attempt-00119 interrupted, then rerun `specdev implement`.

### Why this is serious

- Ctrl-C is an ordinary operator action, not corruption.
- Status can prove the process is stale but cannot make durable state agree.
- A stale optional Brainstorm reviewer can block an otherwise approved and
  completed implementation much later.
- The low-level stack trace appears after review approval, when the user expects
  a final commit.
- Manual internal-API recovery is unsafe, undiscoverable, and version-coupled.

### Proposed fix

Add a first-class recovery command, for example:

```sh
specdev attempt inspect Attempt-00119
specdev attempt recover Attempt-00119 --as=interrupted
```

The recovery command should:

- require the durable status to be `running`;
- prove local liveness is `stale` or require an explicit force confirmation;
- record the previous marker, recovery reason, operator timestamp, and outcome;
- atomically update the Attempt and clear its local marker; and
- print the exact workflow command that can now resume.

Also harden normal interruption:

- install SIGINT/SIGTERM cleanup around spawned reviewers/workers;
- mark the Attempt interrupted in a `finally` path when the foreground command
  aborts;
- reconcile stale owned Attempts before terminal compaction; and
- have `specdev status` return the recovery command as `next_action`.

Automatic stale reconciliation is reasonable when the marker is local, the PID
is definitely dead, and no result artifact was accepted. Ambiguous/remote
liveness should remain fail-closed and require operator confirmation.

## Finding 3: activity summary can preserve a stale running count

### Observed behavior

The first terminal-delivery attempt wrote `status.activity` before compaction
failed. At that moment Attempt-00119 was still durably running, so the completed
Assignment recorded:

```json
{
  "provider_attempts": {
    "total": 5,
    "completed": 4,
    "interrupted": 0,
    "running": 1
  }
}
```

After Attempt-00119 was recovered as interrupted, rerunning
`specdev implement` reused the existing `status.activity` instead of
recomputing it. The final durable Assignment therefore says one Attempt is
still running even though runtime compaction succeeded and removed every
Attempt record.

### Proposed fix

- Never persist terminal activity while any owned Attempt is still `running`.
- Reconcile stale Attempts before computing activity.
- Recompute activity during idempotent terminal recovery when cached activity
  contains `running > 0` or when an Attempt status changed after the snapshot.
- Optionally bind activity to an Attempt-set digest so stale summaries are
  detectable.
- Add a terminal invariant: completed/compacted work must report zero running
  Attempts.

## Finding 4: installed build identity was too weak

### Observed behavior

The live run used `/opt/homebrew/bin/specdev` because no workspace-local wrapper
existed. `specdev --version` reported only:

```text
0.0.4
```

The installed package was `0.0.4` with `releaseDate: 2026-08-04`. The local
specdev-cli checkout was also `0.0.4`, but at commit `1c25b65` with
`releaseDate: 2026-08-08` and substantial workflow changes, including the
candidate-receipt and progress improvements from Assignment 00046.

The semver string therefore could not distinguish the old behavior being live
tested from the newer source being inspected for fixes.

### Proposed fix

Expose build identity in human and JSON output:

```json
{
  "version": "0.0.4",
  "release_date": "2026-08-08",
  "revision": "1c25b65f05b7...",
  "installation": "/opt/homebrew/lib/node_modules/@specdev/cli"
}
```

Useful additions:

- `specdev --version --json`;
- release date or short revision in ordinary `--version` output;
- a warning when installed runtime/template build identity differs from the
  project-recorded SpecDev build;
- a reliable workspace-local launcher generated by `specdev update`; and
- a diagnostic in every Attempt record identifying the driving CLI build.

This would have immediately shown that the receipt issue belonged to the
2026-08-04 installed build and was already fixed on current main.

## Finding 5: progress output was high-volume but low-information

### Observed behavior

The implementation worker ran for 1,293 seconds. The foreground received a
progress line approximately every 15 seconds, usually equivalent to:

```text
SpecDev Attempt-00120 progress: worker; 17m 30s elapsed;
process live_local; logs active; milestone none; fresh.
```

The implementation reviewer then ran for 157 seconds with quiet/stale logs and
no semantic milestone. The workflow remained healthy, but the user-facing
channel accumulated many nearly identical updates without explaining whether
the worker was reading, editing, testing, repairing, or writing evidence.

Current main now provides optional bounded milestone files, which is a good
direction. The remaining issue is that optional milestones can remain absent
for the entire long Attempt.

### Proposed fix

- Require or strongly prompt a milestone at major phase boundaries: plan read,
  editing, focused verification, evidence writing, and review synthesis.
- Safely derive a fallback from the latest explicit `Specdev:` announcement;
  never expose reasoning or raw provider output.
- Emit heartbeats on state changes immediately, then back off unchanged lines
  from 15 seconds to 60 seconds.
- Include latest task ID and verification pass/fail counts when available.
- Distinguish `provider thinking/waiting` from `local command running`.

The goal is one useful bounded line, not more log volume.

## Finding 6: incomplete receipt was detected after completion in the installed build

### Observed behavior

The globally installed 2026-08-04 build created the Assignment delivery commit
and printed `Assignment complete`, while its final receipt also said:

```text
Evidence: incomplete
Evidence issues: unresolved_risks_missing
```

The outcome contained the risk disclosure inline, but the installed parser
required an exact `## Unresolved risks` heading. A bounded Adhoc added the
heading and proved the in-memory receipt became complete with zero issues.

### Current-main assessment

This appears already fixed by specdev-cli Assignment 00046:

- candidate receipt preflight happens before delivery;
- reviewed candidate identity is revalidated;
- canonical outcome structure is documented/validated; and
- legacy inline `Unresolved risks:` text is normalized.

No duplicate product fix is recommended without first reinstalling current
main and rerunning the focused regression. The remaining improvement is build
identity and upgrade visibility, so users know whether they are exercising the
fixed code.

## Prioritized recommendations

### P0: safe Attempt interruption and recovery

1. Mark Attempts interrupted on SIGINT/SIGTERM.
2. Add `specdev attempt inspect/recover`.
3. Reconcile provably stale local Attempts before terminal compaction.
4. Make status emit the exact recovery command.

### P0: explicit review identity and rerun semantics

1. Include reviewer profile/guides in review cache identity.
2. Show saved versus configured profile before spawn/cache reuse.
3. Add audited `--rerun` and `--refresh-profile` behavior.
4. Preserve all review rounds rather than overwriting evidence.

### P1: terminal activity consistency

1. Compute activity only after all Attempts are terminal.
2. Refresh stale cached activity during idempotent recovery.
3. Enforce zero running Attempts for completed/compacted work.

### P1: unique build identity

1. Include release date and revision in version output.
2. Record CLI build identity in Attempts and delivery receipts.
3. Warn when the installed driver lags the project's workflow/runtime build.

### P2: lower-volume semantic progress

1. Make milestones reliable at phase boundaries.
2. Fall back to sanitized announcements.
3. Back off unchanged heartbeat lines.

## Suggested focused regressions

1. Review a contract with Opus, switch local config to Fable, amend the
   contract, rerun review, and assert either Fable launches or an explicit
   frozen-profile decision is required.
2. Re-run an unchanged approved contract with `--rerun` and assert a new audited
   review round is retained without losing the previous verdict.
3. Start a reviewer, send SIGINT, and assert its Attempt becomes interrupted and
   its marker is cleared.
4. Seed a running Attempt with a dead local PID, run status, and assert the JSON
   contains a usable recovery command.
5. Complete an Assignment with a stale historical Brainstorm Attempt and assert
   compaction either safely reconciles it or stops before completed status with
   a precise recovery action.
6. Recover that Attempt and rerun completion; assert terminal activity reports
   zero running and one interrupted Attempt.
7. Assert `specdev --version --json` distinguishes builds with the same semver
   but different release dates/revisions.
8. Run a long fixture Attempt without provider-authored milestones and assert
   progress falls back to bounded semantic context while unchanged heartbeats
   back off.

## Scope of this note

This note reports workflow behavior and source inspection only. It does not
modify SpecDev product code, run the specdev-cli test suite, or propose changing
the successful OceanData App product delivery.

