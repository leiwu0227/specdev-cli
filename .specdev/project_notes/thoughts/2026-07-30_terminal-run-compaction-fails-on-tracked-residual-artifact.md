# Terminal run compaction fails on a tracked residual artifact

## Summary

SpecDev can become unable to create any new Assignment when a terminal
RippleGraph run has been compacted but one file beneath its run directory
remains tracked by Git.

The durable Assignment record correctly says the old Assignment is terminal,
and `.specdev/.ripplegraph/current.json` can correctly have a null focus.
However, restoring or checking out the tracked residual file recreates the run
directory without `checkpoint.json`. Scheduler discovery and idempotent shelf
cleanup then treat directory existence as proof that a complete run exists and
fail while reading the missing checkpoint.

This was observed in DataPortal while promoting completed Discussion `D00027`
to a new Assignment.

## Observed state

The prior Assignment was:

- Assignment: `00186`
- Run: `assignment-lifecycle-20260728T15130009`
- Durable lifecycle: `shelved`
- RippleGraph focus: `null`

The run directory contained only this Git-tracked file:

```text
.specdev/.ripplegraph/runs/assignment-lifecycle-20260728T15130009/
  artifacts/approve-contract/output.json
```

It did not contain:

```text
checkpoint.json
transition-log.jsonl
```

Attempting to promote a completed Discussion failed:

```text
$ specdev assignment --from-discussion=D00027
Cannot create Assignment: no checkpoint.json found for run assignment-lifecycle-20260728T15130009
```

The CLI-recommended workspace refresh did not repair the state:

```text
$ specdev update
$ specdev assignment --from-discussion=D00027
Cannot create Assignment: no checkpoint.json found for run assignment-lifecycle-20260728T15130009
```

The documented idempotent shelf recovery also failed:

```text
$ specdev assignment shelf 00186 --reason="..."
Could not finish idempotent shelf cleanup: no checkpoint.json found for run assignment-lifecycle-20260728T15130009
```

## Root cause

Terminal compaction removes the RippleGraph run directory, but Git can restore a
tracked descendant afterward. This creates a residual directory that is neither
a valid live run nor a fully absent compacted run.

Two recovery paths use directory existence as a proxy for checkpoint
existence.

In `src/commands/assignment-shelf.js`, `finalizeShelvedRuntime()` returns early
only if the run directory does not exist. If any residual descendant recreates
the directory, it immediately calls `readCheckpoint()`:

```js
const path = runDir(specdevPath, status.run_id)
if (!(await fse.pathExists(path))) {
  return { compacted: false, run_id: status.run_id, attempts_removed: 0 }
}
const checkpoint = readCheckpoint(specdevPath, status.run_id)
```

In `src/utils/artifact-retention.js`,
`compactTerminalWorkflowRuntime()` has the same assumption:

```js
const path = runDir(specdevPath, runId)
const runExists = await fse.pathExists(path)
if (runExists) {
  const checkpoint = readCheckpoint(specdevPath, runId)
  // ...
}
```

The scheduler also enumerates the residual directory as a run and fails before
it can start a fresh Assignment. As a result, a terminal historical artifact
can block all future focused workflows.

## Why this state is plausible

RippleGraph runtime is transient, but files beneath `.specdev/.ripplegraph/runs`
have previously entered Git history. Terminal compaction removes the local
directory, but it cannot guarantee that a later checkout, merge, pull, or reset
will not restore a tracked descendant.

Therefore, cleanup must not assume that a checkpoint-less run directory is
impossible. Git restoration makes it a durable recovery case.

## Expected behavior

When the durable Assignment record is terminal and its referenced run directory
exists without `checkpoint.json`, SpecDev should:

1. classify the directory as terminal residue rather than a live run;
2. verify that it is not the focused run and has no live Attempt ownership;
3. remove or quarantine the residual runtime directory;
4. complete idempotent cleanup successfully; and
5. allow creation of a fresh Assignment.

The CLI must not silently discard a checkpoint-less directory associated with a
non-terminal Assignment. That case may represent corruption or interrupted
work and should remain a hard error with a precise recovery message.

## Recommended fix

Make terminal cleanup depend on both durable lifecycle authority and checkpoint
presence:

- If the run directory is absent, cleanup is already complete.
- If `checkpoint.json` exists, preserve the current status validation before
  compaction.
- If `checkpoint.json` is absent and the durable owner is verified terminal,
  treat the directory as residual runtime and remove it after checking for live
  Attempts and focused ownership.
- If `checkpoint.json` is absent and terminal ownership cannot be proven, fail
  without deleting anything.

Scheduler enumeration should also skip or explicitly report checkpoint-less
residual directories instead of allowing one malformed historical directory to
make the entire workspace unavailable. The semantic Assignment command can
then invoke terminal recovery where durable ownership is known.

Separately, terminal delivery should prevent `.specdev/.ripplegraph/runs/**`
from remaining tracked. Compaction should either stage the deletion in the
terminal delivery commit or validate that no tracked runtime descendants remain
before reporting success.

## Regression coverage

Add focused tests for these cases:

1. Shelf an Assignment, compact its run, recreate only a tracked-style artifact
   under the old run directory, rerun shelf cleanup, and verify successful
   removal.
2. After that recovery, create a new Assignment and verify that scheduler
   discovery succeeds.
3. Create a checkpoint-less run directory owned by a non-terminal Assignment
   and verify that cleanup refuses to delete it.
4. Create a terminal residual directory with a live Attempt marker and verify
   that cleanup refuses to remove it.
5. Verify terminal completion and shelving leave no tracked files beneath their
   compacted run directories.

## Scope

This is a SpecDev lifecycle and runtime-retention bug. It does not involve
DataPortal product code or the content of Discussion `D00027`.
