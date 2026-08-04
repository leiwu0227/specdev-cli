# OceanQuant/OceanData live SpecDev workflow friction

**Date:** 2026-08-04  
**Observed in:** OceanQuant, OceanData, and OceanData_app  
**Severity:** high for adapter drift; medium for cross-repository coordination  
**Status:** live-test feedback for SpecDev maintainers; no product change is
made by this note

## Context

This note records firsthand friction from a multi-repository OIS curve project.
The work moved repeatedly between:

- OceanQuant conventions and curve construction;
- OceanData raw quote population and generated OIS-step histories;
- OceanData_app startup and dataset access;
- independent Claude Opus reviews; and
- a planned historical pricing comparison against Velocity.

The technical work was naturally iterative. We first diagnosed a transient SOFR
spike, then changed OIS-step construction to use meeting-swap tickers, extended
the implementation to seven currencies and four cuts, populated an experimental
dataset, corrected availability-policy ownership, repaired the enhanced OIS
front-end composition, and finally audited remaining historical discontinuities.

SpecDev's durable contracts and reviews were valuable. The largest drag was not
the existence of gates. It was that the coding agent often could not reliably
discover which version of the workflow to follow, how work in one repository
depended on another, or what the next cross-repository action should be.

## Executive summary

The highest-priority defect is **silent platform-adapter drift**. OceanQuant's
tracked `AGENTS.md` still advertises SpecDev `0.0.2` and instructs agents to read
files that no longer exist, while its installed `.specdev/_main.md` and
RippleGraph runtime are current. `specdev update` intentionally preserves
existing adapters and only leaves a general manual-update hint. Because
`AGENTS.md` has higher instruction priority than `.specdev/_main.md`, the stale
adapter can override the current workflow at the exact point where the agent is
trying to orient itself.

The second major gap is **cross-repository lifecycle coordination**. Handoffs
are currently free-form Markdown notes, and the user becomes the scheduler by
saying “OceanData is done, take a look” or “what should be next here?”. The
notes are useful human records but do not create machine-readable dependency,
delivery, or resumption state.

Recommended order:

1. Add managed adapter blocks plus adapter-drift detection and repair.
2. Add a first-class, repository-neutral handoff manifest and status view.
3. Make completed outcomes publish machine-readable follow-up candidates.
4. Surface reviewer configuration and test authority before approval.
5. Standardize evidence indexes so machine receipts remain easy for humans to
   act on.

## What worked well

### Exact contract discussion

Brainstorm contracts provided a good place to pin down domain decisions before
coding. For this project that prevented several plausible but incorrect fixes:

- using futures as mandatory OIS-step inputs;
- blending OIS-step and ordinary OIS pillars without a clear composition rule;
- making OceanData own the canonical runtime availability policy; and
- filling typed historical gaps with synthetic values.

The user could inspect the proposed behavior and refine it before implementation.

### Independent implementation review

The repeated request for Claude Opus at xhigh effort was not empty ceremony.
Independent review helped expose scope and policy errors before they became
embedded in the data pipeline. Exact-hash approval and durable review verdicts
made the accepted state auditable.

### Durable cross-repository notes

Free-form handoff notes were much better than relying on conversation history.
They let one repository state the exact ticker contract, receipt hashes,
population constraints, and next expected consumer action. The problem is that
these notes are not connected to lifecycle state automatically.

### Typed population gaps

SpecDev encouraged explicit evidence. The final OceanData population classified
all 14,521 omitted candidate dates and had zero untyped gaps. That made it
possible to distinguish raw-data opportunities from policy, calendar, and
solver exclusions.

## Finding 1: stale platform adapters can contradict the installed workflow

### Direct evidence

OceanQuant currently contains a modern installed runtime:

- `.specdev/_main.md` describes Direct, Adhoc, Discussion, Assignment, Mission,
  Test Audit, RippleGraph, workspace-local CLI pinning, and semantic commands;
- `.specdev/workflow.json` declares workflow version `1.0.0`;
- `.specdev/agents.yaml` configures the worker and reviewer; and
- `.specdev/_router.md` and
  `.specdev/project_notes/assignment_progress.md` do not exist.

At the same time, OceanQuant's root `AGENTS.md` says:

- `Version: 0.0.2 (assignment-first restructure)`;
- read `.specdev/_router.md`;
- read `.specdev/project_notes/assignment_progress.md`;
- follow the old five-gate scaffolding workflow; and
- treat that obsolete directory map as the source of truth.

Its `CLAUDE.md` repeats much of the same stale workflow. OceanData's
`AGENTS.md` also points to `_router.md` and `assignment_progress.md` while its
installed `.specdev/_main.md` is current.

The mismatch is explained by current update behavior:

- `specdev update` replaces managed `.specdev` system files;
- existing platform adapters are explicitly preserved;
- missing adapters are backfilled, but existing adapters are not patched; and
- the update command tells the operator to inspect `_guides/update_guide.md`
  for manual changes.

Preserving project-specific instructions is correct. Preserving a stale
SpecDev-generated block without detecting that it references removed runtime
files is not.

### User impact

This causes more than documentation inconvenience:

- The coding agent starts by opening missing paths.
- Old gates can be treated as mandatory even though RippleGraph owns current
  transitions.
- Direct questions may be inflated into Assignments.
- Current commands such as Discussion, Adhoc, Mission, `specdev next`, and
  workspace-local CLI pinning are hidden.
- Reviewer and autocontinue behavior can be inferred from obsolete prose rather
  than the active workflow and `agents.yaml`.
- The highest-priority repository instruction conflicts with the workflow it is
  supposed to activate.

This was the clearest avoidable drag in the live test.

### Proposed fix

Use a managed block inside existing adapters, for example:

```markdown
<!-- specdev:managed:start version=1 -->
Read `.specdev/_main.md` and follow its current workflow. Run the workspace-local
`.specdev/cache/bin/specdev` when present. Announce meaningful workflow actions
with `Specdev: <action>`.
<!-- specdev:managed:end -->
```

`specdev init` and `specdev update` should:

1. create the block when absent;
2. update only the bytes inside the block;
3. preserve all project-owned content outside the block;
4. detect legacy SpecDev prose that references removed managed paths;
5. offer a dry-run diff before adopting or replacing that legacy block; and
6. fail or warn prominently when an adapter names missing workflow files.

A `specdev doctor` or `specdev update --check` command should report:

```text
Installed runtime: workflow 1.0.0
AGENTS.md adapter: legacy 0.0.2, references 2 missing managed paths
CLAUDE.md adapter: legacy 0.0.2, references 2 missing managed paths
Repair: specdev update --adapters
Project-owned adapter text outside the managed block will be preserved.
```

This check should be part of orientation output, because orientation is exactly
where stale adapter text is most damaging.

## Finding 2: cross-repository handoffs are documents, not lifecycle edges

### Observed behavior

The OIS work repeatedly reached states such as:

- OceanQuant implementation complete, blocked on OceanData population;
- OceanData population complete, waiting for OceanQuant policy update;
- OceanQuant policy update complete, waiting for OceanData_app startup check;
- generated data available, but pricing tests waiting on discontinuity analysis;
  and
- one repository's completed receipt superseding assumptions in another
  repository's active brainstorm.

The practical workflow was:

1. write a Markdown note into the target repository's
   `.specdev/project_notes/thoughts`;
2. ask the user to start or correct an Assignment there;
3. wait for the user to report that the external Assignment was done;
4. manually locate its latest contract, outcome, receipt, review verdict, and
   Git revision; and
5. reconstruct what the originating repository should do next.

This made the user the cross-repository event bus. A local `specdev status` can
be correct and still cannot answer the user's actual question: “what is next
for the overall OIS effort?”.

### Proposed fix

Introduce a small repository-neutral handoff record. It should not require one
monorepo or let one repository mutate another repository's lifecycle. A source
repository could create a signed/pinned request such as:

```yaml
version: 1
id: H00042
from:
  repository: oceanquant
  work_item: Assignment-00169
  revision: 6b93c97
to:
  repository: oceandata
objective: populate four-cut swap-only OIS-step histories
requires:
  artifacts:
    - implementation/oceandata-handoff.md
    - implementation/coverage-evidence.json
completion_contract:
  receipt: assignment_00113_population_receipt.json
  required_status: completed
resume:
  repository: oceanquant
  suggested_lane: Assignment
  objective: validate stored curves and historical pricing
```

Useful commands could be:

```text
specdev handoff create --to ../oceandata --from Assignment-00169
specdev handoff accept H00042 --assignment Assignment-00113
specdev handoff complete H00042 --receipt <path>
specdev handoff status --related
```

The receiving repository should explicitly accept the handoff. Creation alone
must not grant authority or silently start work there.

The source status view should then be able to say:

```text
OceanQuant Assignment-00169: complete
External dependency H00042: completed by OceanData Assignment-00113
Pinned receipt: e2ca2f...
Suggested next local action: create pricing-validation Assignment
```

## Finding 3: “what next?” requires manual archaeology

### Observed behavior

The user asked variants of “what should be the next SpecDev Assignment?” many
times. Answering correctly required reading:

- the active or most recently completed Assignment;
- its outcome and review verdict;
- project thoughts written after completion;
- sibling-repository outcomes and receipts;
- current Git state; and
- later policy corrections that superseded earlier notes.

`specdev next` is intentionally scoped to a focused RippleGraph workflow. It
should not guess product strategy. However, completed work currently has no
small standard place to publish follow-up candidates and their prerequisites,
so even mechanical sequencing must be reconstructed from prose.

### Proposed fix

Add a structured follow-up section to Assignment and Mission outcomes:

```yaml
follow_ups:
  - id: validate-historical-pricing
    state: blocked
    blocked_by: H00042
    suggested_lane: Assignment
    repository: oceanquant
    objective: compare native and enhanced curves against Velocity
  - id: populate-raw-discontinuities
    state: ready
    suggested_lane: Assignment
    repository: oceandata
    objective: populate recoverable exact-cut raw observations
```

`specdev status` could render these as recommendations without automatically
creating work. This preserves user authority while eliminating routine
archaeology.

Thought notes should also support explicit supersession metadata. During this
project, a later availability-policy correction intentionally superseded part
of an earlier handoff. Without structured `supersedes`/`superseded_by` links,
agents must infer which sections remain authoritative.

## Finding 4: reviewer configuration is durable but not visible enough

### Observed behavior

The user repeatedly said “run a review using Claude Opus 5 xhigh effort”. In
OceanQuant, `.specdev/agents.yaml` already configures:

```yaml
reviewer:
  provider: claude
  model: opus
  effort: xhigh
```

The repetition suggests the configured review identity was not visible or
trusted at the decision point. Older workflow prose also still describes
choosing a reviewer interactively, while the current SpecDev CLI has moved
provider/model/effort into `agents.yaml` with diagnostic overrides.

### Proposed fix

Before review approval or launch, render the resolved profile and its source:

```text
Reviewer: claude / opus / xhigh
Profile source: .specdev/agents.yaml
Override: none
Implementation review: required
On approval: continue automatically to the next authorized phase
```

Record the resolved provider, model, effort, profile hash, and any override in
the review receipt. This lets the user say “run the review” without repeating
the configuration and makes stale adapter instructions easier to detect.

## Finding 5: test confirmation should be bound to approved authority

The SpecDev CLI repository's current adapter instruction says to confirm with
the user before running any test command. This is safe but too broad as a
general generated policy. Once a user approves a contract that explicitly
names focused verification lanes, asking again before every test interrupts
automatic implementation without adding meaningful authority.

The better distinction is:

- focused, local, non-destructive tests explicitly named in an approved
  contract are authorized by that approval;
- unplanned full suites, expensive/integration environments, networked tests,
  destructive tests, and tests that mutate external state require separate
  authority; and
- Direct or Discussion work remains read-only unless the user separately asks
  for execution.

The CLI could expose the frozen verification authority before contract approval
and refuse out-of-contract test lanes automatically. This is both safer and
less interruptive than an unconditional conversational confirmation rule.

## Finding 6: machine evidence needs an actionable human index

The OceanData population receipts were strong machine evidence: exact counts,
hashes, pins, typed reasons, and protected-tree snapshots. But when the user
asked which historical discontinuities could be populated, the receipt did not
contain a human-readable date-level missing-input ledger. The coding agent had
to aggregate 28 curve/cut histories manually and write a separate 223-line
handoff.

SpecDev should not prescribe domain-specific evidence fields. It can require an
evidence index that maps acceptance criteria and notable failures to the
machine artifacts that prove them:

```yaml
evidence_index:
  - claim: all 28 histories populated
    artifact: implementation/preflight-evidence.json
    selector: $.pairs
  - claim: omitted dates are fully typed
    artifact: implementation/preflight-evidence.json
    selector: $.untyped_gap_count
  - action: query missing raw observations
    artifact: implementation/missing-input-ledger.jsonl
    human_summary: outcome.md#remaining-data-gaps
```

For large data Assignments, the outcome should include both:

- a compact decision-oriented summary; and
- a pointer to exact row/date/ticker records needed for follow-up action.

Hashes prove stability, but a hash alone does not tell the next worker what to
query.

## Finding 7: feature descriptions and templates can drift

The SpecDev CLI's current `feature_descriptions.md` says Assignment 00016 added:

`templates/.specdev/_templates/workflow_feedback_note.md`

That file is no longer present in the source tree. Durable historical feature
descriptions are useful, but a “Key files” list reads like current navigation.
When files are later removed or replaced, the description should either be
marked historical or point to the successor location.

A lightweight documentation-link check could validate only paths intentionally
declared as current. Historical records should clearly label paths as
historical and need not keep them alive forever.

## Finding 8: mandatory per-subtask announcements are too granular

The `Specdev: <action>` prefix makes workflow adherence visible. Requiring it
before every small read-only command or poll creates transcript noise and makes
the meaningful phase changes harder to see.

The unit should be a meaningful operation:

- new lifecycle phase;
- side-effecting command;
- diagnostic branch;
- blocker;
- changed plan; or
- long-running attempt/review milestone.

Multiple read-only inspections within one already announced diagnostic subtask
should not require repeated announcements.

## Recommended implementation slices

### Slice 1: adapter drift safety

- Add managed adapter blocks.
- Add legacy-block adoption with dry-run diff.
- Add `specdev doctor` or `specdev update --check`.
- Detect references to removed managed paths.
- Show runtime, adapter, graph, and CLI versions together.
- Add fixtures for an OceanQuant-like `0.0.2` adapter upgraded over a current
  `.specdev` runtime while preserving project Python instructions.

### Slice 2: cross-repository handoff protocol

- Define a small versioned handoff schema.
- Add create, accept, complete, and inspect operations.
- Require explicit receiver acceptance.
- Pin revisions, artifacts, receipt hashes, and resumption hints.
- Render related handoff state without mutating sibling repositories.

### Slice 3: outcome follow-ups and supersession

- Add optional structured follow-ups to terminal outcomes.
- Render ready and blocked follow-ups in status.
- Add `supersedes`/`superseded_by` metadata for thought/handoff notes.
- Keep all recommendations advisory until the user chooses a lane.

### Slice 4: visible execution authority

- Show the resolved worker/reviewer profile before launch.
- Record the profile hash in review receipts.
- Freeze named test lanes at contract approval.
- Require new approval only for materially broader or externally mutating
  verification.

### Slice 5: evidence usability

- Add an optional evidence-index schema.
- Encourage a compact human summary beside large JSON receipts.
- Let outcomes link actionable residual records, not only counts and hashes.
- Add current/historical semantics to feature-description file references.

## Suggested acceptance scenarios

1. Run `specdev update --check` in a repository whose `.specdev` runtime is
   current but whose `AGENTS.md` references `_router.md`. The command must
   report a blocking or prominent drift diagnostic and a non-destructive repair
   path.
2. Repair that adapter and prove that project-owned Python environment guidance
   remains byte-for-byte unchanged outside the managed block.
3. Create a handoff from repository A to repository B. Repository B must remain
   unchanged until it explicitly accepts the handoff.
4. Complete the receiving Assignment and attach a receipt. Repository A's
   related-status view must show the satisfied dependency and suggested local
   follow-up without starting it.
5. Launch a review and show the exact resolved Claude/model/effort configuration
   before any provider process starts.
6. Approve a contract with two focused local test commands. The implementation
   may run those commands without another prompt but must refuse an unapproved
   full, networked, or destructive suite.
7. Publish a large machine receipt whose evidence index points from each
   acceptance claim and residual action to a precise artifact or selector.

## Expected outcome

The desired workflow is still strict: explicit lane selection, exact contract
authority, independent review, bounded verification, and durable evidence. The
improvement is that an agent should always be able to determine:

- which workflow version actually governs the repository;
- whether root adapter instructions agree with that runtime;
- which reviewer and verification authority are frozen;
- which external repository dependency is pending or satisfied;
- which follow-up is ready locally; and
- which exact evidence record makes that follow-up actionable.

That would remove most of the drag observed in the OIS live test without
weakening the safeguards that made the work reliable.
