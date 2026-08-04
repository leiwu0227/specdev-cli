# DataPortal live workflow friction and improvement opportunities

## Context

This note records friction observed while using SpecDev live in the DataPortal
repository. The representative workflow was standalone Assignment `00249`,
which introduced content-aware companion frontend asset publication so an
unchanged frontend prebuild would not invalidate Cargo's cached DataPortal
crate.

The workflow successfully covered contract authoring, optional Brainstorm
review, exact-hash approval, automatic design and implementation, focused
verification, required implementation review, and a final delivery commit. The
core authority model worked well. Most of the drag came from visibility,
completion reporting, and post-workflow branch and artifact management rather
than from the contract or review gates themselves.

## What worked well

### Exact contract authority

The contract checkpoint exposed the exact path and SHA-256 before approval.
The implementation stayed bound to that reviewed contract, and the final
review reported no material divergence. This made `proceed` meaningful: the
user was approving a specific durable artifact rather than an informal summary.

### Author and reviewer separation

Claude's Brainstorm and implementation reviews were evidence-based and
independent of the implementation worker. The strict verdict envelope made it
clear which review could authorize a transition and prevented an advisory
review from being mistaken for approval.

### Automatic delivery

After approval, one `specdev implement` invocation performed design,
implementation, focused evidence gathering, implementation review, completion,
and the delivery commit. The resulting contract, plan, outcome, receipts, and
verdicts were straightforward to audit afterward.

### Proportional verification authority

The contract authorized focused Node, frontend-build, and Cargo-fingerprint
evidence without authorizing the full repository suite. The worker was able to
prove the build-cache boundary without running unrelated expensive lanes.

## Observed sources of drag

### 1. Long-running attempts have very little live visibility

The implementation worker ran for approximately 640 seconds and the required
reviewer ran for approximately 352 seconds. During most of those intervals, the
only emitted message was equivalent to:

```text
agent is still running; raw output is in .specdev/cache/attempts/
```

That heartbeat proved the controller had not exited, but it did not distinguish
between active work, a quiet compiler, a blocked subprocess, or an agent that
had stopped making progress. To verify that the attempt was healthy, the
foreground coding CLI manually inspected the raw attempt log and process state.

This is the highest-impact usability problem observed. It recreates the same
uncertainty that motivated Assignment `00249`: a long, quiet operation looks
hung even when it is progressing normally.

### 2. Status output foregrounds history over the active decision

`specdev status --json` correctly described the active phase and next command,
but it also returned the complete historical run list. In a repository with
many completed Assignments and Missions, the current decision was surrounded by
large amounts of unrelated lifecycle history.

The history is useful for diagnostics, but it is not normally needed to answer
"what should happen next?". The default status response should optimize for
the active workflow and expose history only through an explicit flag or a
separate command.

### 3. Automatic completion reports too little at the terminal

When automatic delivery finished, the immediate output was essentially:

```text
implementation review: approved
Next: Assignment complete.
```

The useful completion information existed in durable artifacts, but the user
still needed additional commands to discover:

- the delivery commit;
- the changed-file summary;
- which acceptance checks passed;
- the outcome path;
- unresolved risks, such as the absence of native Windows evidence; and
- whether the working tree was clean.

The final automatic command should provide a compact delivery receipt directly
instead of requiring a manual post-completion inspection sequence.

### 4. Git branch state can misrepresent completed Mission work

After merging the latest Mission branch into `main`, two historical child
branches appeared in `git branch --no-merged main`:

```text
specdev/M00006/00155
specdev/M00007/00170
```

Both child outcomes had actually been reconciled and integrated through later
gap-resolution Assignments. Git ancestry alone could not express that semantic
integration, so the branches looked like pending work even though both parent
Missions were complete and approved.

The durable Mission records were sufficient to resolve the ambiguity, but the
operator had to search those records manually. Completed Missions should make
the disposition of child branches explicit and ideally offer safe cleanup.

### 5. Legacy runtime artifacts amplify unrelated Git operations

Fast-forwarding the completed Mission branch into `main` produced thousands of
lines of output, dominated by historical RippleGraph artifacts and Attempt
records from older workflows. The product merge itself was simple, but the
tracked workflow runtime made it look enormous.

Current SpecDev guidance correctly treats runtime checkpoints and process
records as temporary. Repositories with older tracked runtime history still
need a clear compaction or migration path so ordinary Git operations remain
readable.

### 6. `specdev update` does not communicate no-op updates clearly

Repeated `specdev update` invocations reported the full set of system files as
"Updated" even when the installed version and resulting tracked content were
unchanged. This makes it difficult to distinguish a real template/runtime
upgrade from an idempotent verification pass.

The command should differentiate at least:

- changed;
- already current/verified;
- newly installed; and
- preserved project-owned content.

### 7. Mandatory per-subtask announcements become noisy during polling

The repository instruction to announce `Specdev: <action>` before every
subtask provides useful transparency at phase boundaries. Applied literally to
every polling interval and diagnostic check, it creates repetitive transcript
traffic without adding much decision value.

This is primarily a project-instruction issue rather than a lifecycle-engine
bug, but the default guidance could recommend announcements for meaningful
phase changes, new commands with side effects, blockers, and changes of plan
rather than for every heartbeat poll.

## Recommended improvements

### Priority 1: structured progress events

Long-running `implement`, `reviewloop`, and Mission controller commands should
emit structured, bounded progress events such as:

```json
{
  "attempt": "Attempt-00644",
  "phase": "verification",
  "current_step": "second unchanged production frontend build",
  "last_completed": "focused Node tests: 7 passed",
  "elapsed_seconds": 418,
  "quiet_process": "vite",
  "next_heartbeat_seconds": 30
}
```

The controller does not need to expose raw model reasoning. It can surface
explicit progress markers supplied by the worker, the current bounded command,
subprocess liveness, and the last durable receipt. A stale-progress threshold
could tell the foreground CLI when log inspection is warranted.

### Priority 2: a complete terminal delivery receipt

On success, `specdev implement` should print or return a structured summary
containing:

- Assignment identity and lifecycle;
- contract hash and divergence classification;
- implementation-review verdict;
- delivery commit and commit type;
- acceptance-criterion results;
- verification commands and concise results;
- changed project paths grouped by area;
- unresolved risks or environment gaps;
- outcome and verdict paths; and
- final worktree cleanliness.

This information already exists. The improvement is aggregation, not a new
ceremony.

### Priority 3: concise status by default

Make the default `status` response contain only:

- current focus;
- lifecycle and phase;
- pending decision or active attempt;
- next valid semantic command;
- dirty-path summary; and
- blocking condition, if any.

Move the historical `runs` array behind `--history`, `status history`, or an
explicit JSON field-selection option.

### Priority 4: Mission finish and branch-disposition support

Consider a command such as:

```text
specdev mission finish M00007 --into=main
```

It could:

1. verify the Mission is terminal and approved;
2. verify or perform a fast-forward into the selected local target;
3. report child branches whose commits were directly integrated, reconciled,
   superseded, or intentionally excluded;
4. optionally delete only branches whose durable disposition is safe; and
5. leave remote deletion as a separate explicit operation.

Even without automating Git mutations, a `mission branch-audit` report would
prevent reconciled child branches from being mistaken for unfinished work.

### Priority 5: legacy runtime compaction tooling

Provide a dry-run-first command that identifies tracked terminal runtime
artifacts which current retention rules would no longer keep. It should explain
what durable records remain before offering a safe cleanup change. This would
complement the existing layout migration commands and reduce noisy future
merges without deleting active recovery state.

### Priority 6: idempotent update reporting

`specdev update` should compare installed content and report a result such as:

```text
Changed: 0
Already current: 42
Preserved project files: 7
SpecDev v0.0.4 is already installed.
```

This would make repeated live-testing updates trustworthy and quickly reveal
whether the command actually changed the worktree.

### Priority 7: phase-level announcement guidance

Revise the suggested `AGENTS.md` language so transparency remains mandatory
but the unit of announcement is a meaningful operation or phase, not every
poll. For example:

> Before starting each meaningful workflow phase, side-effecting operation,
> diagnostic branch, or changed plan, announce `Specdev: <action>`. Heartbeat
> polling within the same announced phase does not require a new announcement.

## Suggested order of work

1. Add structured attempt progress and stale-progress detection.
2. Aggregate the final delivery receipt.
3. Make status concise by default.
4. Add Mission branch-disposition reporting and optional finish support.
5. Add legacy runtime compaction diagnostics.
6. Improve update idempotence reporting.
7. Refine the default announcement guidance.

The first three changes would materially improve daily use without changing
SpecDev's safety or authority model. Branch and artifact lifecycle improvements
would then reduce the operational cleanup required after large Missions.

## Expected outcome

The desired experience is not fewer safeguards. It is a workflow where the
user can always tell:

- what is running;
- whether it is making progress;
- what decision is required;
- what was delivered and verified; and
- whether any branch or runtime cleanup remains.

SpecDev already records nearly all of this information. Surfacing it at the
right time would remove most of the observed drag while preserving exact-hash
approval, independent review, durable evidence, and automatic delivery.
