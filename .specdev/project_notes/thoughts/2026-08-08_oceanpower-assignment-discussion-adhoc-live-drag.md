# Oceanpower Assignment, Discussion, and Adhoc live workflow drag

**Date:** 2026-08-08

**Observed in:** Oceanpower Assignment `00016`, Discussion `D00002`, and Adhoc
`AH-20260808T070336983Z-dad1`

**Severity:** critical for partial dirty adoption; high for evidence-repair cost
and stale callable ownership; medium for status/progress clarity

**Status:** live-test feedback for SpecDev maintainers

## Context

This note records friction from a continuous Oceanpower live test:

1. Assignment `00016` implemented the web-first master dashboard, secure agent
   pairing and lifecycle operations, heartbeat/lease behavior, and continuous
   reconciliation.
2. The managed implementation worker could not execute dependency-gated ASGI
   tests and had no PostgreSQL DSN.
3. Implementation review correctly rejected the evidence overstatement, not
   the product.
4. An automatic repair wrote a result value outside the allowed outcome enum.
5. Authorized host evidence then produced `15 passed` for the live ASGI and
   operations surface and `5 passed` against a disposable PostgreSQL 17
   cluster.
6. A continuation worker and another implementation review were needed to
   normalize and approve those already-complete receipts.
7. Discussion `D00002` explored cloud fleets and produced untracked
   `proposal.md` and `design.md` plus RippleGraph call state.
8. The user explicitly authorized an Adhoc to adopt all six dirty D00002 paths
   while writing a project note.
9. `specdev adhoc finish` committed the RippleGraph records and project note but
   silently omitted the two discussion artifacts, leaving the repository dirty.

The product result was good. Assignment `00016` ended approved with no material
divergence and all three acceptance criteria passed. The workflow also added
real value: exact contract authority, independent evidence review, honest
environment deviations, and durable recovery artifacts all worked. The main
drag came from mismatches between declared ownership, evidence schema,
executor capability, and final Git behavior.

## Executive summary

The highest-priority defect is `--adopt-dirty` not behaving transactionally.
The user authorized adoption of every displayed dirty path. Adhoc accepted the
start, completed, and created a delivery commit, but two authorized paths were
not included:

```text
?? .specdev/discussions/D00002_on-demand-oceanpower-cluster-launch-and-operatio/
```

The final receipt claimed the authorized D00002 artifacts were included, while
the commit contained only D00002's RippleGraph records. This is worse than a
clean refusal because the command represented a partial operation as complete.

The second major issue is evidence repair. A reviewer correctly identified two
unexecuted verification surfaces, but closing that evidence required an invalid
automatic repair attempt, manual artifact correction, authorized host tests, a
new provider continuation attempt, and another review. The candidate product
did not change. Evidence-only closure should not require a broad implementation
worker when the host can attach typed receipts to the exact candidate revision.

The third issue is callable ownership and visibility. `D00002` remained active
at its finalize node, but `specdev discussion D00002` reported that another
local session owned it after the earlier command had exited. Meanwhile,
`specdev status --json` reported `focus: null` and `lifecycle: idle`; only the
dirty-path list hinted that a Discussion existed.

Recommended order:

1. Make dirty adoption an exact, persisted, all-or-nothing path transaction.
2. Refuse ownership conflicts before Adhoc starts; never silently omit paths.
3. Add first-class evidence attachment/validation without a provider worker.
4. Validate repair artifacts against outcome/progress schemas before accepting
   the repair attempt.
5. Add stale claim recovery and show concurrent callables in normal status.
6. Make executor capability and supported interpreter part of approval
   preflight.

## What worked well

### Exact contract authority was useful

The approved contract was hash-bound and explicit about the dashboard,
pairing, lifecycle, heartbeat, lease, and reconciliation behaviors. The final
review found no hidden product-scope divergence.

### Independent review caught an evidence integrity problem

The first implementation reviewer did not invent a product defect. It correctly
observed that:

- the live ASGI scenario had skipped because the worker interpreter lacked
  `fastapi` and `httpx`; and
- all PostgreSQL tests had skipped because no DSN was configured.

The worker outcome had nevertheless marked AC-1 and AC-2 as passed. Blocking
delivery until this was corrected was exactly right.

### Host evidence cleanly proved the candidate

The repository's supported host interpreter was available at:

```text
/Users/leiwu/code/oceanwave/lib/oceanscript/venv-macos/bin/python
```

It produced:

```text
15 passed in 0.42s
```

for the focused dashboard/operations command. After explicit authorization, a
disposable PostgreSQL 17 cluster produced:

```text
5 passed in 0.30s
```

The cluster was stopped and moved to Trash. This was a good example of honest
managed-worker deviations superseded by stronger host evidence.

### Durable artifacts made recovery possible

The implementation verdict, outcome, progress receipts, repair record, and
attempt state were sufficient to recover after the original foreground process
ended. The final review independently reran the ASGI surface and approved the
candidate.

### The dirty-worktree guard detected real local state

Implementation initially stopped because `.fireplace/` was untracked. The user
chose to ignore it and it was committed separately before the Assignment Git
boundary was established. The guard was correct, even though the timing could
be improved.

## Finding 1: `--adopt-dirty` silently performed a partial adoption

### Reproduction

Discussion `D00002` had six dirty paths:

```text
.specdev/.id-counters.json
.specdev/.ripplegraph/calls/D00002/artifacts/brainstorm/output.json
.specdev/.ripplegraph/calls/D00002/checkpoint.json
.specdev/.ripplegraph/calls/D00002/transition-log.jsonl
.specdev/discussions/D00002_.../brainstorm/design.md
.specdev/discussions/D00002_.../brainstorm/proposal.md
```

The user explicitly authorized adopting them. Adhoc started with:

```text
specdev adhoc start \
  "Document on-demand Oceanpower cloud-cluster architecture..." \
  --adopt-dirty
```

The Adhoc then created:

```text
.specdev/project_notes/thoughts/on-demand-cloud-clusters.md
```

and finished successfully:

```text
Adhoc AH-20260808T070336983Z-dad1: completed
Starting Git commit: af7e5aa...
Ending Git commit:   5b05928...
```

The ending commit contained:

- `.specdev/.id-counters.json`;
- three D00002 RippleGraph files;
- the Adhoc receipt; and
- the new project note.

It did **not** contain D00002's `proposal.md` or `design.md`. Immediately after
successful completion:

```text
## main...origin/main [ahead 14]
?? .specdev/discussions/D00002_on-demand-oceanpower-cluster-launch-and-operatio/
```

The Adhoc outcome text said that the authorized D00002 discussion artifacts
were included. The Git commit contradicted that receipt.

### Why this is critical

`--adopt-dirty` is the user's explicit authorization boundary. It must mean one
of two things:

1. every resolved path is adopted; or
2. the command refuses and lists paths that cannot be adopted.

Silently adopting workflow-runtime files while excluding the human-authored
artifacts makes the Git boundary and receipt unreliable. It can also strand an
active callable in a state where its checkpoint is committed but its claimed
outputs are not.

### Proposed fix

Persist an exact adoption manifest at `adhoc start`, for example:

```json
{
  "starting_revision": "af7e5aa...",
  "adopted_paths": [
    ".specdev/.id-counters.json",
    ".specdev/.ripplegraph/calls/D00002/checkpoint.json",
    ".specdev/discussions/D00002_.../brainstorm/proposal.md",
    ".specdev/discussions/D00002_.../brainstorm/design.md"
  ]
}
```

At finish:

1. resolve the same path identities without directory elision;
2. stage every adopted path plus the Adhoc-owned delta;
3. compare the staged set with the adoption manifest;
4. fail before committing if any adopted path is missing;
5. show `excluded_paths` with machine-readable reasons;
6. after commit, verify no adopted path remains dirty; and
7. build the receipt from the actual committed path set, not the requested
   outcome prose.

If active Discussion outputs are protected from Adhoc ownership, reject the
start with an actionable message:

```text
Cannot adopt 2 paths owned by active Discussion D00002:
  .../proposal.md
  .../design.md
Complete, cancel, or separately checkpoint D00002 first.
No Adhoc was started.
```

Do not allow a protected-path policy to become a silent filter.

## Finding 2: the Discussion claim survived the command that established it

### Observed behavior

The initial command created and advanced the Discussion:

```text
specdev discussion \
  "On-demand Oceanpower cluster launch and operation on Amazon EC2 and Alibaba Cloud"

Discussion D00002: awaiting_review
```

Later, after the originating CLI process had exited, this command failed:

```text
specdev discussion D00002

Discussion D00002 is already claimed by another local session
```

Its checkpoint remained:

```json
{
  "status": "active",
  "position": {
    "node": "finalize"
  }
}
```

No normal status output identified the claimant, its PID/session, claim age, or
how to determine whether the claim was stale.

### Why this caused drag

A Discussion is intentionally authored by the foreground coding CLI, but the
semantic command itself is short-lived. If the claim belongs to the process
that invoked `specdev discussion`, it should normally be released when that
process exits. If it belongs to the broader coding session, SpecDev needs an
explicit durable session identity and a reclaim path.

Without either behavior, a recoverable concurrent callable looks permanently
owned and the operator cannot distinguish valid concurrency protection from a
stale lock.

### Proposed fix

- Store claim owner type, stable session ID, PID, hostname, acquisition time,
  last heartbeat, and command.
- Treat a dead local PID as stale when the claim is process-owned.
- Add:

  ```text
  specdev discussion status D00002 --json
  specdev discussion D00002 --reclaim-stale
  ```

- Make normal failure output show the owner and safe next action.
- Release process-scoped claims in a `finally` path on normal command exit.
- Preserve protection for genuinely active concurrent sessions.

## Finding 3: `specdev status` said idle while a Discussion was active

### Observed behavior

With D00002 active at `finalize`, `specdev status --json` returned:

```json
{
  "focus": null,
  "lifecycle": "idle",
  "next_action": {
    "command_line": "specdev do \"<intent>\""
  },
  "dirty_paths": {
    "count": 6
  }
}
```

This may be internally consistent because Discussions are concurrent callables
and do not take the focused Assignment/Mission scheduler. It is still confusing
as user-facing project status: the only active workflow was omitted from the
summary and the suggested next action ignored it.

### Proposed fix

Retain focused lifecycle semantics but add callable visibility:

```json
{
  "focus": null,
  "lifecycle": "idle",
  "active_callables": [
    {
      "id": "D00002",
      "kind": "discussion",
      "node": "finalize",
      "claim": "stale_or_unknown",
      "next_action": "specdev discussion D00002"
    }
  ]
}
```

Human output could say:

```text
Focused scheduler: idle
Active callables: D00002 discussion (finalize, claim needs attention)
```

The top-level next action should not imply a blank slate while unfinished
callables exist.

## Finding 4: the evidence repair agent authored an invalid outcome value

### Observed behavior

The first implementation review returned `needs_changes` because AC-1/AC-2 had
been marked passed on skipped evidence. An automatic resolver correctly tried
to make the outcome honest, but wrote:

```text
Not fully verified
```

as an acceptance result. The SpecDev outcome schema permits only:

```text
Passed | Failed | Blocked
```

The controller rejected the repaired artifacts, requiring another correction
cycle.

### Why this matters

The repair agent was invoked specifically to bring artifacts back into the
workflow contract. It should receive the exact enum and validate its candidate
before returning. An invalid repair consumes provider time and moves the
workflow no closer to convergence.

### Proposed fix

- Include the exact outcome grammar and JSON schemas in the repair prompt.
- Provide a deterministic `validate assignment-artifacts` operation to the
  repair worker.
- Validate changed artifacts before accepting the repair attempt as complete.
- Return field-level errors directly to the same repair process while it still
  owns context:

  ```text
  outcome.md acceptance AC-1 result:
  expected Passed|Failed|Blocked; got "Not fully verified"
  ```

- Prefer a generated/structured acceptance record and render Markdown from it.

In this case the correct interim value was `Blocked`, with an environment
deviation explaining the skipped managed-worker surface. Once superseding host
receipts existed, it could become `Passed`.

## Finding 5: skipped verification was allowed to support `Passed`

### Observed behavior

The implementation worker's interpreter lacked `fastapi`/`httpx`, so the live
ASGI scenario skipped. PostgreSQL scenarios also skipped without a DSN. The
worker still wrote AC-1 and AC-2 as passed. Independent review prevented final
delivery, but the contradiction should have been caught deterministically
before review.

### Proposed fix

Make verification receipts typed:

```json
{
  "criterion": "AC-1",
  "command": "...pytest...",
  "disposition": "skipped",
  "skip_reason": "missing fastapi in selected executor",
  "can_satisfy": false
}
```

Then enforce:

- a `Passed` criterion must have at least one satisfying executed receipt;
- a skipped receipt cannot satisfy a criterion unless the approved contract
  explicitly declares that skip as acceptable evidence;
- source inspection may supplement, but not silently replace, required live
  execution; and
- deviations and superseding receipts must reference one another explicitly.

This deterministic gate can reject the overstatement before spending an
independent reviewer round.

## Finding 6: evidence-only closure required another provider worker

### Observed behavior

After the host produced the required evidence, the foreground repaired only:

- `outcome.md`;
- `implementation/progress.json`; and
- `implementation/repair-result.md`.

No product code changed. Rerunning `specdev implement` still launched a
continuation worker (`Attempt-00089`) to normalize those artifacts, then a new
implementation review (`Attempt-00090`).

The Assignment summary reported:

```text
attempt_count: 6
agent_duration_ms: 2493019
provider_reported_tokens: 400242
elapsed_ms: 9056711
```

Some of that cost came from substantive implementation and required review.
The evidence-only tail was nevertheless more expensive than necessary.

### Proposed fix

Add a first-class host evidence path, for example:

```text
specdev assignment evidence add 00016 \
  --criterion=AC-1 \
  --candidate=<git-hash-or-tree-digest> \
  --command="..." \
  --result=passed \
  --summary="15 passed in 0.42s"

specdev assignment validate-artifacts 00016
specdev reviewloop implementation --assignment=00016
```

Required properties:

- evidence binds to the exact candidate revision/tree;
- host authority and user authorization are recorded;
- stdout is bounded/redacted;
- the original skipped receipt is retained as a deviation;
- a deterministic tool updates or validates progress/outcome structure;
- no implementation provider is launched when no product or authored design
  repair is required; and
- independent review still runs when policy requires it.

The distinction should be explicit:

```text
product repair required  -> continuation worker + review
artifact prose repair    -> bounded artifact repair + review
new host evidence only   -> attach/validate receipt + review
```

## Finding 7: executor capability remained discover-as-you-fail

### Observed behavior

The managed worker could not exercise two known surfaces:

- its default Python environment lacked the ASGI dependencies; and
- it had no PostgreSQL DSN.

The supported repository interpreter existed, PostgreSQL 17 was already
installed through Homebrew, and only an authorized temporary cluster was
needed. These facts were discovered after implementation rather than frozen in
the execution policy before approval.

This repeats the environment friction already recorded in
`2026-08-08_oceanpower-mission-live-workflow-friction.md`, but Assignment
`00016` demonstrates that the same issue persists outside Missions.

### Proposed fix

Make executor preflight apply to standalone Assignments too:

```yaml
verification_executors:
  managed-worker:
    python: /managed/default/python
    imports:
      fastapi: false
      httpx: false
    postgres: false
  authorized-host:
    python: /Users/leiwu/code/oceanwave/lib/oceanscript/venv-macos/bin/python
    imports:
      fastapi: true
      httpx: true
    postgres_binary: /opt/homebrew/opt/postgresql@17/bin/postgres
    temporary_service_requires_authorization: true
```

At approval, show which criteria map to which executor and which decisions may
still require the user. Automatic mode should not begin while a required
criterion has no declared capable executor or accepted residual disposition.

## Finding 8: long-running progress remained too operational

### Observed behavior

The implementation worker ran for roughly 29 minutes. Progress mostly exposed
liveness and log freshness rather than the current semantic activity. After
completion, polling the former outer session returned:

```text
write_stdin failed: Unknown process id 78103
```

The durable Assignment state and delivery commit made recovery straightforward,
but the foreground had to infer completion from Git and workflow artifacts.

### Proposed fix

- Promote the latest sanitized worker `Specdev:` announcement as a bounded
  progress milestone.
- Persist a final process disposition before the foreground session disappears.
- Make `specdev status` show the most recent attempt completion, verdict, and
  delivery commit without requiring Git archaeology.
- On resume, print a compact recovery statement:

  ```text
  Attempt-00090 ended while foreground output was detached.
  Verdict: approved
  Delivery commit: af7e5aa
  Assignment: completed
  ```

The unknown process ID may belong partly to the surrounding execution wrapper,
but SpecDev can make the user experience robust by treating its durable state
as the normal recovery channel.

## Finding 9: dirty-boundary discovery happened later than ideal

### Observed behavior

Assignment implementation was ready to start when an unrelated local tool
directory, `.fireplace/`, caused the Git boundary to refuse. The guard correctly
required a decision. The user chose `.gitignore`, which required a separate
commit before implementation.

### Proposed improvement

Run the exact implementation-boundary preview before contract approval, not
only when implementation begins. Show:

```text
Implementation boundary preflight:
  untracked: .fireplace/
Decision required before automatic execution:
  ignore | checkpoint separately | adopt | stop
```

This preserves strictness while moving predictable interaction before the user
says `proceed` and expects automation.

## Consolidated priority list

### P0: transactional adoption

- Persist exact adopted paths.
- Refuse protected active-workflow paths before start.
- Stage/commit all adopted paths or none.
- Verify the post-commit dirty delta.
- Generate receipts from actual committed paths.

### P1: typed evidence closure

- A skipped receipt cannot satisfy `Passed` by default.
- Validate outcome/progress artifacts before reviewer launch.
- Give repair agents exact schemas and field-level validation.
- Add host evidence attachment that does not launch an implementation worker.

### P1: callable claim recovery and visibility

- Record claim owner/liveness.
- Release or reclaim stale local claims.
- Surface active Discussions/Test Audits in `specdev status`.

### P2: execution preflight

- Resolve supported interpreter and imports before approval.
- Declare external-service and network capabilities.
- Route evidence to the capable authorized executor.

### P2: progress and recovery UX

- Surface semantic milestones.
- Persist final attempt disposition.
- Summarize detached completion from durable state.

## Suggested regression scenarios

1. Start a Discussion with untracked proposal/design and call-state files.
   Start Adhoc with `--adopt-dirty`. If active outputs are protected, verify
   Adhoc refuses before creating state and lists both paths.
2. Allow adoption of an untracked directory containing two files. Verify both
   are in the final commit and the receipt's committed paths match `git show`.
3. Simulate a staging filter that drops one adopted path. Verify finish aborts
   before commit with the exact missing path.
4. Exit the process that owns a Discussion claim. Verify a new local session
   can resume or receives a safe stale-reclaim action.
5. Keep one Discussion active with no focused Assignment. Verify status says
   `Focused scheduler: idle` and also lists the Discussion and next action.
6. Give the repair agent an invalid acceptance result such as `Not fully
   verified`. Verify deterministic validation keeps the same repair attempt
   active and reports the enum error.
7. Record only skipped receipts for a required acceptance criterion. Verify the
   outcome cannot become `Passed`.
8. Attach an authorized host receipt to an unchanged candidate. Verify no
   implementation worker launches and required review still sees both the
   original skip and superseding pass.
9. Preflight a repository whose default interpreter lacks FastAPI but whose
   configured interpreter has it. Verify the supported interpreter is bound
   before approval.
10. Complete a reviewer attempt while foreground output is detached. Verify
    status reports the final verdict and delivery transition deterministically.

## Overall assessment

I felt meaningful drag, but not from the central idea of SpecDev. Contract
approval, independent review, and durable evidence improved the Oceanpower
result. The drag came from operations that looked stronger than they were:

- `Passed` could temporarily mean “the required command skipped”;
- a repair attempt could violate the schema it was meant to restore;
- `--adopt-dirty` could mean “some authorized paths were committed”;
- `completed` could leave authorized adopted paths dirty; and
- `idle` could coexist with an active, apparently unrecoverable Discussion.

These are boundary-integrity problems. The workflow will feel substantially
lighter once each boundary is transactional and typed:

```text
approval binds exact contract and execution policy
evidence binds exact candidate and executor
repair validates before transition
adoption binds exact paths
completion proves exact commit and clean owned delta
status lists every active workflow identity
```

The highest-value immediate fix is the Adhoc adoption invariant because it
affects user authorization, Git contents, receipts, and recoverability at once.
