# DataPortal unsupported Assignment, shelf, and Adhoc pivot drag

## Context

This note records workflow friction observed during a live DataPortal session on
2026-08-08. The sequence was ordinary exploratory product work rather than an
exceptional recovery exercise:

1. Assignment `00291` was opened to add historical-day valuation to the
   Velocity FX pricer.
2. Authenticated smoke tests established that Citi FX Optix does not expose a
   provider-native historical valuation capability that DataPortal can safely
   use.
3. The user then selected a small, independent UI change: replace the hard-to-
   read `V-R` and `V-F` sidebar marks with related Velocity product glyphs.
4. The UI change was correctly classified as an Adhoc.

The end result was good: the unsupported capability findings were preserved,
the icon change was isolated, and the Adhoc produced one receipt and one final
delivery commit. The drag was in moving cleanly from an active but infeasible
Assignment into an unrelated Adhoc.

This is a useful live-test case because provider capability discovery is common.
An Assignment can become infeasible without being erroneous, abandoned, or
temporarily paused.

## Observed command sequence

The initial attempt to preserve Assignment `00291` was:

```text
specdev assignment shelf 00291 --reason="Citi FX Optix does not expose provider-native historical valuation..."
```

SpecDev refused the transition until an explicit snapshot decision was made.
It printed:

```text
Worktree changes require an explicit snapshot decision.
Non-disposable dirty paths: 10 (...)
Concurrent callable paths left unstaged: 2 (...D00040...)
Rerun: specdev assignment shelf ... --snapshot-token=<token>
```

Rerunning with the token succeeded and produced two commits:

```text
specdev(assignment): shelf snapshot 00291
specdev(assignment): shelf 00291
```

Afterward, `specdev status --history` reported:

```text
SpecDev status: shelved
Focus: Assignment 00291 (...)
Dirty paths: 2 (...D00040...)
Next: specdev do "<intent>"
```

The two untracked Discussion `D00040` artifacts then had to be committed
manually before `specdev adhoc start` could safely run. Only after that separate
Git operation could the Adhoc start, implement, verify, and finish.

## What worked well

### The dirty-worktree guard prevented accidental adoption

SpecDev did not silently absorb Assignment or Discussion artifacts into the
icon Adhoc. This is the correct safety property. The UI delivery commit contains
only the intended icon component, sidebar wiring, focused test changes, and the
Adhoc receipt.

### Shelf preserved useful negative findings

The authenticated provider probes and the conclusion that historical FX
valuation is unsupported were not discarded. Future work can inspect the
Assignment rather than repeat the same provider investigation.

### Adhoc was a good fit once it could start

The icon change needed no graph, review scheduler, worktree, or approval gate.
`specdev adhoc finish` created a concise receipt and one delivery commit while
recording focused tests, lint, architecture, frontend build, and bundle-budget
evidence.

### The CLI explained path ownership

Separating `Non-disposable dirty paths` from `Concurrent callable paths left
unstaged` was materially better than a generic "worktree dirty" failure. It
showed that Assignment `00291` and Discussion `D00040` were different ownership
domains.

## Main sources of drag

### 1. No precise terminal state exists for provider-unsupported work

`shelf` was the least-destructive available choice, but it is semantically
wrong. Shelf normally means "preserve this work for possible continuation."
Here, the Assignment reached a valid terminal conclusion: the requested feature
cannot be implemented against the verified provider contract.

`cancel` is also a poor fit because it suggests the work was discarded and is
irreversible. The investigation was successful and its negative result is worth
retaining.

The missing lifecycle outcome is something like:

```text
closed: unsupported
closed: infeasible
closed: no-change-required
```

Such an outcome should be terminal, immutable, auditable, and clearly distinct
from delivered, cancelled, abandoned, blocked, or shelved.

### 2. Lane changes are not transactional

The user made one high-level decision: preserve the unsupported finding and do
the icon change as an Adhoc. Operationally, that decision required several
unrelated-looking steps:

1. try to shelf;
2. interpret the snapshot refusal;
3. rerun shelf with an opaque token;
4. inspect Git and workflow state;
5. manually commit unrelated Discussion artifacts;
6. verify the worktree is clean;
7. start the Adhoc.

Every individual guard is defensible. The combined experience makes a normal
change of direction feel like recovery work.

SpecDev understands the ownership of all these artifacts, so it should be able
to offer a single dry-run-first pivot transaction.

### 3. The snapshot-token handshake is safe but unnecessarily opaque

The first shelf command did not present human choices such as:

- snapshot Assignment-owned changes only;
- leave concurrent callable artifacts untouched;
- abort;
- separately checkpoint named concurrent artifacts.

Instead, it emitted a rerun command with a hash-like token. The token prevents a
time-of-check/time-of-use mistake, which is valuable, but the user-facing model
is "copy this opaque command" rather than "confirm this explicit ownership
decision."

The token should remain an internal guard while the CLI exposes a semantic flag
or confirmation result such as `--snapshot=owned`.

### 4. Shelving creates two terminal-adjacent commits

The shelf operation produced both a snapshot commit and a terminal shelf commit.
For a zero-product-change investigation, this is noisy. It also means that a
simple lane pivot adds multiple workflow commits before the actual Adhoc commit.

If two internal stages are required for crash safety, SpecDev could still
squash or finalize them into one user-visible terminal commit after success.
Interrupted operations could retain the recovery commit only until the
transition completes.

### 5. A shelved Assignment remains presented as the focus

After successful shelving, status still printed:

```text
Focus: Assignment 00291
Next: specdev do "<intent>"
```

That is ambiguous. A shelved, immutable Assignment should not look like the
active scheduler focus. The CLI should clear `.current`, or distinguish clearly
between `Last focus` and `Active focus`.

A better result would be:

```text
SpecDev status: idle
Last workflow: Assignment 00291 — closed unsupported
Next: choose Direct, Adhoc, Discussion, Assignment, or Mission
```

### 6. Concurrent Discussion artifacts can survive outside a clean lifecycle boundary

Discussion `D00040` had two untracked proposal/design files. Shelf correctly
left them unstaged because they belonged to a concurrent callable, but the next
workflow could not start until they were handled manually.

This indicates that Discussion completion or pausing did not establish a clean
Git boundary. The foreground agent had to invent a conventional Git commit:

```text
docs(specdev): preserve FX pricer discussion
```

The CLI should own this transition. A terminal Discussion should either create
its durable commit, explicitly register that its artifacts are intentionally
uncommitted, or provide an exact `discussion checkpoint/close` command.

### 7. Dirty-state diagnostics identify the problem but not the shortest safe resolution

The path categories were useful, but the operator still had to infer the safe
commands. The CLI knew:

- which paths belonged to Assignment `00291`;
- which paths belonged to Discussion `D00040`;
- which paths were runtime state;
- which paths could not be adopted by the Adhoc.

It could therefore have printed a bounded resolution menu or structured JSON,
for example:

```text
To close Assignment-owned state:
  specdev assignment close 00291 --outcome=unsupported --snapshot=owned

Concurrent Discussion state remains:
  specdev discussion checkpoint D00040
  specdev discussion close D00040

Then start the requested Adhoc:
  specdev adhoc start "..."
```

### 8. Capability discovery happened too late in the lifecycle model

The user explicitly requested an Assignment, so creating it was correct.
However, this kind of work begins with a provider-capability question whose
answer may be "unsupported." SpecDev has no especially smooth route for an
Assignment that is intentionally probe-first and may conclude without product
code.

The workflow could recognize a capability-preflight contract or an
investigation outcome without forcing the result into delivery, cancellation,
or shelf semantics.

## Recommended improvements

### Priority 1: add a terminal evidence-preserving `unsupported` outcome

Introduce a semantic command such as:

```text
specdev assignment close 00291 \
  --outcome=unsupported \
  --reason="Citi FX Optix exposes no provider-native historical valuation" \
  --snapshot=owned
```

Expected behavior:

1. validate that the Assignment has a written conclusion/evidence artifact;
2. preserve the contract and investigation result;
3. compact/remove temporary RippleGraph runtime owned by the Assignment;
4. create one terminal commit;
5. clear active focus;
6. report remaining dirt owned by other workflows; and
7. provide the fresh-lane commands now available.

The outcome should be resumable only by explicitly creating a fresh Assignment
from the closed one, just as a provider capability change would represent new
work.

### Priority 2: provide a transactional lane-pivot command

Consider:

```text
specdev pivot \
  --from-assignment=00291 \
  --disposition=unsupported \
  --to=adhoc \
  "Replace the Velocity sidebar lettermarks with product glyphs"
```

The first invocation should be a dry-run or produce an explicit snapshot plan:

```text
Will close:
  Assignment 00291 (10 owned paths) as unsupported

Will not touch:
  Discussion D00040 (2 paths)

Cannot start target Adhoc until D00040 is checkpointed or closed.
Suggested: specdev discussion close D00040
```

If all ownership domains are already clean, a confirmed invocation can close
the source workflow and start the target lane atomically. If it cannot finish,
it should leave either the original state or a clearly recoverable transaction,
not a half-pivoted workspace.

### Priority 3: make snapshot confirmation semantic

Keep the snapshot token for stale-state protection, but expose decisions in
terms of ownership:

```text
--snapshot=owned
--checkpoint-concurrent=D00040
--leave-concurrent
```

The confirmation output should show the exact path count and HEAD used to
compute the token. A rerun may still carry the token internally, but users and
agents should reason about the semantic choice rather than the opaque value.

### Priority 4: make Discussion lifecycle establish its own Git boundary

Add or strengthen commands such as:

```text
specdev discussion checkpoint D00040
specdev discussion close D00040 --outcome=complete
specdev discussion shelf D00040
```

Each should state whether it creates a commit, whether the Discussion remains
callable, and whether its artifacts will block an Adhoc or Assignment product
transition. A completed Discussion should not routinely leave untracked durable
artifacts behind.

### Priority 5: clear or relabel focus after terminal/shelf transitions

The invariant should be:

- active focus points only to a runnable focused Assignment or Mission;
- shelved/closed/cancelled workflows appear as last or historical focus;
- `next` never suggests continuing an immutable workflow; and
- `status` makes the currently available lanes explicit.

If keeping `.current` is necessary for navigation, human output should still say
`Last focus`, not `Focus`.

### Priority 6: consolidate successful shelf/close commits

Preserve crash recovery internally, but after a successful transition expose a
single durable terminal commit wherever possible. If two commits are truly
required, explain their roles in the terminal receipt and provide a stable
trailer linking them.

### Priority 7: add an ownership-aware dirty-state explainer

A command such as:

```text
specdev workspace explain-dirty --json
```

could return, per path group:

- owner type and identity;
- lifecycle state;
- whether it is disposable runtime or durable work;
- whether the proposed next lane may adopt it;
- exact safe checkpoint/close commands; and
- whether a manual Git commit is ever appropriate.

`adhoc start`, `assignment shelf`, and `pivot` could embed the same structured
diagnostic rather than each presenting a different refusal.

## Suggested acceptance scenarios

### Scenario A: unsupported Assignment with no concurrent workflow

1. Start an Assignment.
2. Record evidence that the provider capability is unsupported.
3. Close it with `--outcome=unsupported`.
4. Verify one terminal commit is created.
5. Verify active focus is cleared.
6. Verify an Adhoc can start immediately.

### Scenario B: unsupported Assignment plus dirty concurrent Discussion

1. Start an Assignment and a concurrent Discussion.
2. Write durable artifacts in both.
3. Attempt to pivot the Assignment to an Adhoc.
4. Verify the dry run identifies both ownership domains.
5. Verify no artifacts are cross-adopted.
6. Close/checkpoint the Discussion with a SpecDev command.
7. Complete the pivot without a manual Git commit.

### Scenario C: stale snapshot plan

1. Generate a pivot or close plan.
2. Change one owned file before confirmation.
3. Verify the internal snapshot token rejects the stale plan.
4. Verify the CLI explains that the plan changed and regenerates semantic
   choices rather than only emitting an opaque token failure.

### Scenario D: status after terminal close or shelf

1. Close or shelf the focused Assignment.
2. Run human and JSON status.
3. Verify no immutable workflow is reported as active focus.
4. Verify `next` recommends choosing or starting a fresh lane.

## Lower-priority observations

The strict `Specdev: <action>` announcement rule remains helpful at meaningful
phase boundaries but noisy when applied to every status inspection, build wait,
and post-command verification. This was already documented in
`2026-08-04_dataportal-live-workflow-friction-and-improvements.md`; the current
session confirmed it again but does not change that recommendation.

The local DataPortal project also lacked a callable Playwright binary when a
visual check of the new SVG glyphs was considered. That is repository tooling,
not a SpecDev lifecycle defect, so it should not drive SpecDev product changes.

## Expected outcome

The desired experience is that a user can discover a requested feature is
unsupported, preserve that result, and immediately switch to a small unrelated
change without feeling that they are repairing workflow state.

The safety properties should remain:

- no cross-adoption of dirty paths;
- explicit ownership decisions;
- stale snapshot protection;
- durable negative findings; and
- one clean Adhoc delivery boundary.

The improvement is to make those protections operate as one semantic lane
transition rather than a chain of shelf, token, status, manual Git, cleanup, and
start commands.
