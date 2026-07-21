# State-of-the-art SpecDev workflow and Mission orchestration

**Date:** 2026-07-19
**Last revised:** 2026-07-20
**Status:** Agreed design direction. This is not yet an implementation
specification.

## Purpose

This note describes a simpler SpecDev architecture for interactive intent
discovery, automatic implementation, long-running Mission orchestration,
concurrent read-only Discussions, durable engineering records, and local
knowledge retrieval.

The design optimizes for three things:

1. Preserve the decisions and evidence that make automatic work trustworthy.
2. Avoid process, agent, document, and verification overhead that does not
   materially improve the result.
3. Recover from interruption using Git and ordinary folder artifacts rather
   than database-style execution recovery.

## Core principles

The governing product model is:

> `.specdev` is durable repository state; the coding CLI is a replaceable
> worker.

Consequences:

- Markdown and small structured files are authoritative.
- RippleGraph owns lifecycle state and transitions.
- Git owns source history, revisions, and diffs.
- SQLite is only a disposable local search index.
- Agents provide judgment and implementation; they do not own canonical state
  transitions.
- Interrupted code may be inspected, continued, or rewritten. Exact process
  restoration is unnecessary.
- The user remains responsible for deciding whether concurrent writers are
  safe. SpecDev provides warnings rather than a general file-locking system.
- Expensive operations, especially full test suites and repeated model calls,
  must be justified by the current decision boundary.

## Product model

```text
Repository
  ├─ Assignment
  │    ├─ Task
  │    └─ Attempt
  ├─ Mission
  │    └─ Assignment
  └─ Discussion
```

- **Repository:** Long-lived code, conventions, architecture, records, and
  curated knowledge.
- **Assignment:** The normal bounded unit of design, implementation, review,
  and verification.
- **Mission:** An optional larger objective delivered through an ordered series
  of Assignments under one approved contract.
- **Task:** A checklist step inside one Assignment. Tasks are not independently
  scheduled work by default.
- **Attempt:** One worker invocation or continuation. It is runtime history, not
  work identity.
- **Discussion:** Concurrent, code-read-only exploration that produces
  Brainstorm artifacts but grants no implementation authority.

Start with an Assignment unless the objective genuinely benefits from several
separately understandable and verifiable delivery units. A Mission containing
one Assignment is valid, but should not be the default way to do ordinary work.

## Static RippleGraph architecture

SpecDev uses predefined, versioned graph packages:

```text
assignment-lifecycle       workflow
mission-lifecycle          workflow
discussion-lifecycle       callable
```

There is no generated RippleGraph graph per Mission. Mission Design produces
data in `design/assignments.yaml`; the static Mission graph interprets that
ordered plan and calls the normal Assignment workflow through `workflowRef`.

The Assignment workflow is Mission-agnostic. It receives an approval event and
does not need `mission` versus `standalone` branches throughout the graph.

RippleGraph permits one focused workflow run per workflow root. This is
appropriate for an Assignment or Mission that owns the current lifecycle. A
Discussion uses an isolated callable call, so any number of Discussions may
coexist with a focused Mission without changing `.ripplegraph/current.json`.

Graph packages are registered during `specdev init` or `specdev update`, not
force-registered on every runtime command. Runtime commands read the stable
registry. This prevents concurrent Discussion and Mission commands from
rewriting shared registry state.

Every run or call pins its graph package version. `specdev update` installs new
versions alongside any version referenced by incomplete work. New work uses the
latest version; incomplete work resumes with the version it started with. There
is no automatic active-checkpoint migration.

Assignment and Mission nodes are advanced only by their semantic host commands.
The generic RippleGraph `step`, `decide`, and side-channel `action` surfaces are
diagnostic for other workflows and cannot bypass contract validation, approval
hash checks, delivery artifact validation, or controller policy.

Completed historical Assignments, Missions, and Discussions are documents.
They do not require runtime compatibility or artifact migration.

## Authoritative state and artifacts

Each fact should have one authority:

- RippleGraph: lifecycle position, transition history, and approval events.
- Git: revisions, changed files, and diffs.
- Contract and plan Markdown: intent, decisions, rationale, and execution plan.
- Outcome Markdown: delivered result, deviations, evidence, and unresolved
  risks.
- Attempt records: provider, model, effort, start/end time, status, and result
  path.
- Verification receipts: exact command, revision, scope, status, and duration.

Do not copy transition histories, complete diffs, changed-file inventories, or
provider transcripts into the human outcome. Base and result revisions are
enough to recover Git facts.

### Canonical folders

```text
.specdev/
  assignments/
    00042_keyword-search/
      brainstorm/contract.md
      design/plan.md
      implementation/progress.json
      review/                         only when review runs
      outcome.md
      status.json

  missions/
    M00001_search-repair/
      mission.yaml
      brainstorm/contract.md
      design/assignments.yaml
      review/                         only when review runs
      outcome.md

  discussions/
    D00001_search-ideas/
      brainstorm/proposal.md
      brainstorm/design.md
      review/verdict.md               only when review runs

  processes/
    ATT-00001.yaml                    small durable invocation record

  cache/                              ignored machine-local state
  worktrees/                          ignored future parallel pool
```

Historical Assignment layouts remain readable and are not rewritten.

Raw stdout, stderr, provider JSONL, PID files, sockets, absolute paths, scratch
files, and `knowledge.sqlite` belong under ignored local cache. They are not
portable engineering records.

`.specdev/.current` remains committed but is only a foreground convenience
pointer:

```yaml
kind: assignment
id: "00042"
```

It does not mean only one piece of work exists. Automatic Mission children and
parallel workers always receive explicit IDs and never depend on or modify
`.current`.

## Assignment lifecycle

```text
Brainstorm              interactive current coding CLI
  -> optional review    user-invoked for standalone work
  -> user approval      one contract gate
  -> Design             automatic
  -> Implementation     automatic
  -> review/evidence    automatic
  -> complete           no routine final user gate
```

### Brainstorm

The current coding CLI collaborates directly with the user. It does not spawn a
separate Brainstorm author.

The authoritative result is one human-readable file:

```text
brainstorm/contract.md
```

It captures:

- Objective and context
- Scope and non-goals
- Expected behavior
- Important decisions
- Constraints and invariants
- Delegated and reserved authority
- Risks and assumptions
- Verification authority
- Acceptance criteria with simple inline IDs

Example:

```md
- AC-1: Keyword search uses OR eligibility by default.
- AC-2: One malformed token does not fail the whole query.
```

There is no duplicated YAML contract projection, acceptance database, or
semantic clause extractor.

### Brainstorm review and approval

Standalone Brainstorm review is optional and user-invoked. Normal review uses
one reviewer. Explicit multi-reviewer risk lenses are deferred until normal
single-reviewer use demonstrates enough value to justify their compute and
aggregation cost.

When review starts, SpecDev temporarily snapshots the current contract as the
baseline. The reviewer returns blocking or materially useful findings. The
current coding CLI addresses them, and the same reviewer may verify the revised
artifact once.

Before approval, SpecDev shows:

- Final reviewer verdict
- Textual changes from the baseline
- A reviewer classification of `none`, `clarifying`, or `material`
- A short explanation of material divergence
- The exact final contract hash

SpecDev does not build a semantic diff engine. The reviewer supplies judgment;
the user decides whether the final contract is acceptable.

User approval records the exact content hash, approving actor, time, and Git
revision. Before approval, an edit requires a final re-checkpoint and makes any
older review visibly stale. After approval, an edit blocks automation; restore
the approved content or create a new Assignment for changed authority.

`--autocontinue`, sticky reviewer selection, and routine per-execution reviewer
prompts are removed. Approval of the reviewed contract is the explicit handoff
to automation.

### Design and Implementation

One worker Attempt normally performs both phases:

1. Write `design/plan.md`.
2. Define ordered Task IDs and acceptance coverage.
3. Execute Tasks inline.
4. Run verification allowed by the approved contract and repository policy.
5. Write a concise result artifact.

Design and Implementation remain separate lifecycle positions, but do not need
separate planning and coding model invocations. There is no normal Design
reviewer in v1.

Tasks do not automatically create agents, worktrees, commits, reviews, or
retries. A standalone Assignment may use explicitly requested Task subagents,
but Mission children execute Tasks inline by default.

An Assignment may carry an optional `kind` hint such as `bugfix`, `refactor`, or
`documentation`. The hint may add a short prompt paragraph; it does not select
a different graph, folder layout, or runtime implementation. The default kind
is `change`.

### Implementation review and completion

One reviewer checks the frozen candidate against the approved contract,
selected guides, current diff or revision, and existing verification receipts.
If it finds blocking issues:

1. The responsible worker receives the findings and current repository state.
2. It fixes the result in a continuation Attempt.
3. The same reviewer verifies the changed revision once.
4. A second failure blocks and reports the unresolved findings.

The reviewer never fixes code directly. Successful required verification and
review complete the Assignment automatically; there is no routine final user
approval.

### Minimal acceptance traceability

The plan may reference contract IDs, and the outcome contains one compact
mapping:

| Criterion | Evidence | Result |
|---|---|---|
| AC-1 | Focused search verification | Passed |
| AC-2 | Invalid-token verification | Passed |

SpecDev validates only that referenced IDs exist and every acceptance criterion
has a final result. It does not build a general coverage engine.

## Mission lifecycle

A Mission is a static foreground orchestrator for a larger bounded objective:

```text
Mission Brainstorm              interactive
  -> optional review
  -> user approval
  -> Mission Design             automatic ordered plan
  -> child Assignment loop      automatic, sequential
  -> Mission review
  -> final integrated verification
  -> complete on Mission branch
```

### Mission identity and folder

Mission IDs are repository-local and stable:

```text
M00001
```

`mission.yaml` stores stable identity and provenance, not duplicated live
lifecycle state. Its provisional creation revision is recorded when the folder
is created; the authoritative base branch and revision are captured at approval.
RippleGraph owns the lifecycle; `design/assignments.yaml` owns the ordered child
plan and child results.

### Mission branch and workspace

A Mission has a dedicated Git branch but no dedicated worktree. The normal
repository worktree checks out the Mission branch. Sequential child workers
modify it directly.

At Brainstorm approval, SpecDev records the base branch and revision, creates or
switches to the Mission branch, and checkpoints the approved contract and
portable state. A dirty worktree does not automatically block approval, but the
approval view lists existing modified and untracked paths and makes their
inclusion explicit. SpecDev never auto-stashes.

If the wrong branch is checked out during resume, SpecDev may offer to switch a
clean worktree. It never switches a dirty worktree automatically.

### Mission Design

The worker profile receives a Mission Design prompt and writes an ordered queue,
not a dependency graph:

```yaml
assignments:
  - id: "00031"
    title: Add schema support
    status: completed

  - id: "00032"
    title: Repair keyword search
    status: running

  - id: "00033"
    title: Add focused verification
    status: pending
```

Supported states are:

```text
pending, running, completed, blocked, cancelled
```

The next child is the first pending Assignment. There is no dependency solver,
readiness calculation, stable/tentative graph, graph visualization, rolling
compilation, or independent branch progress in sequential Mission v1.

### Mission child Assignment

The Mission invokes the normal Assignment workflow through `workflowRef` and
passes the Mission contract, queue entry, relevant completed outcomes, and
explicit IDs.

Every child Brainstorm receives at least one review because the user does not
approve each child personally:

```text
child Brainstorm worker
  -> mandatory reviewer
  -> worker revision if needed
  -> same reviewer verification at most once
  -> Mission approval event
  -> Design + Implementation worker
  -> Implementation reviewer
```

The reviewer checks completeness and alignment with the approved Mission
authority. On approval, the Mission supplies the Assignment's generic approval
event and records the actor as `mission:M00001`. Material authority divergence
or a second failed review blocks for the user.

The Assignment graph only knows that an exact contract revision was approved;
it does not contain Mission-specific lifecycle branches.

### Exception-driven replanning

SpecDev does not invoke a planner or converger after every child. A completed
child normally advances the queue directly.

The child outcome may report:

```yaml
follow_up: none
```

or:

```yaml
follow_up: required
```

Only `required`, a blocking review finding, or failed evidence triggers a Mission
replanning invocation. The worker profile may revise or append pending
Assignments within the approved authority. It does not allocate IDs directly;
the Mission runtime reserves them.

If the route requires changing the destination, scope, constraints, public
behavior, or reserved decisions, Mission v1 blocks. The user restores the
approved contract or creates a new Mission with the changed authority. An
in-place contract-amendment and downstream reconciliation engine is deferred.

### Final Mission convergence

The cost-aware order is:

1. Child Assignments complete with focused verification and normal review.
2. One Mission-level reviewer checks acceptance coverage, integration seams,
   and unresolved risks without re-reviewing every child from scratch.
3. Blocking findings create a final repair Assignment.
4. The same reviewer verifies its findings once after repair.
5. SpecDev runs the authorized final integrated verification command.
6. SpecDev writes the Mission outcome and completes.

If final verification fails, diagnose with focused commands and create a repair
Assignment. Do not rerun the entire suite until there is a new final candidate.

### Foreground execution, pause, and recovery

Mission v1 runs in the foreground. There is no daemon, background mode, PID
service, remote scheduler, or automatic live cancellation subsystem.

Ctrl-C or interruption preserves artifacts and repository changes. `mission
run` resumes from RippleGraph, the ordered queue, Attempt records, and current
repository state.

Only one controller may own the same Mission:

- A live local controller hard-blocks another start.
- A durable `running` record without a live local controller is ambiguous.
- `specdev mission run M00001 --takeover` explicitly marks the old controller
  interrupted and resumes from current state.

To run an unrelated standalone Assignment while a Mission is paused, suspend
the Mission's focused RippleGraph run, complete the external Assignment, then
resume the Mission. No Mission or child process may still be running during
that handoff.

### Checkpoint and delivery

`specdev mission checkpoint M00001` creates a meaningful durable checkpoint of
source and `.specdev` state. `--push` pushes only the current Mission branch,
sets an upstream when needed, and never force-pushes. It creates no empty
commit.

The checkpoint excludes machine-local cache, SQLite, worktree slots, absolute
paths, PID state, and incomplete concurrent Discussion artifacts.

On completion, SpecDev leaves the verified result on the Mission branch and
reports the base branch and final revision. It does not automatically merge,
rebase, push, open a pull request, or call a hosting provider. Delivery remains
the user's normal Git workflow.

## Concurrent Discussion lifecycle

Discussion exists for productive exploration while a long Mission continues:

```text
Mission workflow remains focused and running
  + Discussion D00001 callable
  + Discussion D00002 callable
```

Discussion is a RippleGraph callable because callable checkpoints are isolated
from focused workflow runs. The call ID is the Discussion ID, and human
artifacts live under the corresponding Discussion folder.

### Discussion behavior

```text
create
  -> foreground Brainstorm with current coding CLI
  -> optional user-invoked review
  -> complete
```

A Discussion:

- May inspect the repository.
- Must not modify product source.
- Writes only `brainstorm/proposal.md`, `brainstorm/design.md`, and optional
  concise review feedback.
- Has no worktree, branch, implementation worker, approval contract, Task plan,
  verification phase, or outcome file.
- Is not a background process. An active Discussion means incomplete durable
  thought work, not a running daemon.

Different Discussions may proceed concurrently. Two authors may not edit the
same Discussion simultaneously; a small local session marker prevents a
duplicate local author.

The current coding CLI is the interactive author, so SpecDev cannot reliably
sandbox it after the host session starts. Code-read-only behavior is an explicit
Discussion authority rule. A general sandbox is not added for this feature.

### Moving repository state

A Discussion may observe the repository changing underneath it while a Mission
works. SpecDev accepts this rather than creating a read-only snapshot or
worktree. It records the repository revision at Discussion start and completion.

Discussion conclusions are exploratory evidence. Promotion must revalidate
technical assumptions against the then-current repository.

### Discussion review

Review is optional and user-invoked. One reviewer runs by default using relevant
selected guides. The current coding CLI addresses findings, and the same
reviewer may verify once.

Discussion v1 uses one optional reviewer with selected guides. Explicit parallel
perspectives and verdict aggregation are deferred. There is no approval
transition; the user decides when the Discussion is complete.

### Pause, resume, and list

Closing or crashing the coding CLI leaves the callable checkpoint and Markdown
artifacts intact. `specdev discussion D00001` resumes them.

`specdev discussion --list` shows:

```text
brainstorming, awaiting_review, reviewing, completed
```

along with the last update time. Discussions have no timeouts, automatic
retries, scheduler, or controller process.

### Promotion

Promotion requires a completed Discussion and creates new workflow identity:

```bash
specdev assignment --from-discussion=D00001
specdev mission create --from-discussion=D00001
```

Promotion:

1. Creates a new Assignment or Mission ID and folder.
2. Records the source Discussion ID and artifact hash.
3. Gives the Discussion artifacts to the current coding CLI as Brainstorm
   input.
4. Produces a fresh `brainstorm/contract.md`.
5. Uses the target's normal review and user approval lifecycle.

It does not move folders or migrate callable checkpoints. A Discussion is not
consumed and may inform more than one future target.

## Agent invocation model

There are two configured spawned-agent profiles:

- **worker:** planning, implementation, continuation, repair, and Mission
  replanning prompts.
- **reviewer:** Brainstorm, implementation, Discussion, and final Mission review
  prompts.

The foreground Brainstorm author is the current coding CLI and needs no profile.
Profiles select execution capability; prompts and guides define temporary work.
There is no permanent persona catalog or strict reviewer-role system.

### Portable configuration

```text
.specdev/agents.yaml                    committed repository preference
.specdev/cache/agents.local.yaml        ignored optional override
```

Example:

```yaml
worker:
  provider: codex
  model: gpt-5
  effort: high
  timeout: 60m

reviewer:
  provider: claude
  model: opus
  effort: high
  timeout: 20m
```

Resolution order is:

1. Explicit diagnostic override
2. Machine-local override
3. Committed repository preference
4. SpecDev built-in default

A fresh clone works without a new `specdev init` session. Credentials,
executable paths, and machine-specific substitutions are never committed.

Provider adapters validate and translate `effort`. Unsupported values fail
clearly rather than being silently ignored. There is no adaptive effort,
cross-provider token-budget conversion, or runtime model-selection agent.

A timeout stops one invocation, preserves artifacts and code, and marks the
Attempt interrupted. It never triggers an automatic blind rerun.

### Agent result protocol

Spawned agents return small Markdown results with minimal frontmatter. SpecDev
validates the result and persists the durable artifact.

Reviewer example:

```md
---
verdict: approved
material_divergence: false
---

## Findings

No blocking findings.
```

Worker example:

```md
---
status: completed
revision: abc1234
follow_up: none
---

## Changes

...
```

SpecDev owns IDs, workflow transitions, approval state, queue mutation, and
Attempt status. If only the result envelope is malformed, SpecDev permits one
short formatting-correction invocation without rerunning the work.

Raw output streams to the foreground terminal and may be retained under ignored
cache for diagnosis. Workflow state never depends on parsing raw transcripts.

### Reviewer capability

Read-only means the reviewer cannot author or repair product code. It may:

- Inspect artifacts, code, revisions, and diffs.
- Run static analysis, dry-run commands, or a narrowly targeted test when
  existing evidence is insufficient and policy allows it.
- Return its verdict through stdout or a designated ignored result path for the
  runtime to persist.

It may not edit tracked product or workflow files, apply fixes, update snapshots,
or run a full suite without explicit authority. Temporary and ignored tool output
is allowed. Provider read-only modes are used where available, dangerous bypass
flags are removed, and unexpected tracked changes invalidate the review.

## Curated guide library

Task-specific guidance is useful, but it should be committed reference context,
not live web plugins.

```text
.specdev/guides/
  review.md
  library/
    catalog.yaml
    frontend.md
    accessibility.md
    api-security.md
  project/
    catalog.yaml
    architecture.md
```

- `review.md` defines common evidence, severity, contract-alignment, and verdict
  expectations.
- `library/` contains SpecDev-curated guidance and may be updated by `specdev
  update`.
- `project/` is owned by the repository and is never overwritten by SpecDev.
- A project catalog may point to an existing repository document instead of
  copying it.

Library entries record an ID, summary, signals, applicable phases, source,
license, guide version, and review date. Web material is reviewed, adapted, and
committed. It is never fetched dynamically during an agent invocation.

During Assignment Design, the current agent reads the small catalog and records
separate implementation and review selections. A Discussion reviewer may select
from the catalog at review time. Normally no more than three guides are used in
one invocation.

Repository instructions and the approved contract outrank generic guides.
Implementation and review selections remain separate to avoid correlated blind
spots. Results record the selected guide IDs and versions.

Project-specific guides are written by project maintainers, optionally with the
foreground coding CLI's help and explicit user approval. Automatic workers and
reviewers may recommend a missing guide but never create or modify durable
project guidance.

Start with a small high-quality guide set. A guide marketplace, automatic guide
generation, live web retrieval, and a model-only guide router are deferred.

## Context policy

Do not build a context-packet compiler or file-to-knowledge relevance engine.
Each spawned invocation receives a short list of authoritative paths:

- Approved contract
- Design plan
- Current diff or frozen revision
- Relevant prerequisite outcomes
- Selected guides
- Previous findings for a rerun

The agent inspects the repository and uses knowledge search when it needs more.
Mission Design may record explicit prerequisite outcome paths. SpecDev does not
copy clauses, source excerpts, or knowledge snippets into a synthetic context
document.

## Verification policy

The hard invariant is:

> Never run a full suite when narrower evidence answers the current question.

The approved Brainstorm contract defines the verification envelope, for
example:

```md
## Verification authority

- Focused tests for changed modules: allowed
- Static checks for changed files: allowed
- Snapshot updates: not allowed
- Network-dependent tests: not allowed
- Full suite: requires explicit approval
```

Repository instructions always take precedence. If they require user
confirmation before any test, the automatic worker must stop and ask.

Rules:

- Task: no full suite.
- Mission child Assignment: focused evidence only.
- Standalone Assignment: a full suite at most once, only when broad scope or the
  approved contract requires it.
- Mission: final integrated verification at most once per final candidate.
- Reviewer: reuse receipts and do not run a full suite without explicit
  authority.
- Same command on the same revision: reuse the receipt.
- Flaky result: rerun the failing test, not the suite.
- Full-suite failure: diagnose and repair with focused commands; rerun only on a
  new final candidate.

Assignment Design chooses exact commands inside approved authority. An expensive
or protected command discovered later requires user approval before execution.

## Retry and interruption policy

There are no blind full-agent retries. On failure or timeout:

1. Inspect current source, diff, artifacts, and completed Tasks.
2. If only the output envelope is invalid, perform one formatting correction.
3. Otherwise preserve the repository state and durable failed/interrupted
   Attempt. A later explicit `implement` or `mission run` invocation
   may create a new Attempt and rewrite or continue ordinary code; `--takeover`
   is needed only when the earlier controller is still durably marked running.
4. Do not automatically spend another full-agent invocation after a provider
   failure or timeout.

Do not roll back partial code automatically. A later coding agent can repair or
rewrite ordinary files. Review has one initial pass and at most one verification
rerun after fixes.

## Knowledge system

### Three layers

1. **Historical records:** Completed Assignment and Mission intent, decisions,
   evidence, and outcomes.
2. **Living knowledge:** Curated current Markdown about architecture,
   conventions, decisions, and recurring hazards.
3. **Search index:** Disposable local SQLite FTS derived from selected Markdown
   sources.

SQLite does not own durable knowledge, processed state, or promotion decisions.
`knowledge.sqlite` is ignored and safe to delete.

### Rebuild behavior

```bash
specdev knowledge rebuild
```

The command:

1. Discovers authoritative source files.
2. Builds a uniquely named temporary database.
3. Creates schema and FTS tables.
4. Inserts and classifies documents deterministically.
5. Validates schema version and row counts.
6. Atomically replaces the previous cache.
7. Preserves the previous database on failure.

The database records schema version, source paths, source hashes or mtimes, and
index time. The first search rebuilds synchronously when the cache is missing or
stale, so a fresh clone requires no initialization session.

### Search behavior

Default eligibility uses OR semantics because coding agents often submit a bag
of related terms. Search normalizes punctuation and duplicate terms, preserves
code-oriented identifiers, ignores an individually invalid token, ranks
matched-term coverage, and then uses BM25 relevance.

Default indexed/searchable authority is:

1. Living knowledge
2. `big_picture.md` and current project notes
3. Verified Assignment outcomes
4. Verified Mission outcomes

Incomplete, abandoned, raw Brainstorm/Design artifacts, Discussions, review
logs, skills, and superseded records are excluded by default. Explicit scopes
may expose `history`, `workflow`, or `all`.

Vector retrieval is deferred until measured lexical failures justify it.

### No automatic distillation pipeline

Completed work writes concise outcomes, which are searchable history. Curated
knowledge remains human-maintained Markdown. There is no candidate extraction,
confidence score, contradiction engine, promotion queue, processed ledger,
automatic knowledge rewriting, or `knowledge promote` command in the initial
design.

## Concurrency and worktrees

Sequential work uses the normal repository worktree:

- Standalone Assignment: current repository worktree.
- Sequential Mission: current repository worktree on the Mission branch.
- Mission child: the same Mission worktree and branch.
- Discussion: no worktree; code-read-only sidecar.

No Mission worktree and no child worktree are created in v1.

SpecDev warns about existing uncommitted changes, current HEAD, other recorded
Attempts, and unattributed dirty changes. It does not claim it can identify which
external editor changed a file. There is no file-ownership map or product-source
lock system.

Only a duplicate controller for the same Mission, a duplicate author for the
same Discussion, and a duplicate live local reviewer for the same work item are
hard coordination conflicts.

Future explicitly parallel Assignments may lease a bounded pool under:

```text
.specdev/worktrees/slot-01/
```

The pool is physically inside the repository but Git-ignored. A tracked
`.specdev/.gitignore` includes managed entries for `cache/` and `worktrees/`.
Before pool use, SpecDev verifies the path is ignored, not tracked, not a
symlink, below the expected pool root, and registered with `git worktree`.
Removal uses `git worktree remove`, never generic recursive deletion.

No worktree allocator, lease manager, parallel scheduler, rebase queue, or
integrator is implemented until sequential Mission v1 is proven useful.

Repository-local linear IDs remain readable:

```text
Assignment  00042
Mission     M00001
Discussion  D00001
```

Only the foreground runtime allocates IDs. A short atomic repository-local
reservation lock prevents two terminals from choosing the same ID. Workers may
propose new work but never allocate identity themselves.

## Minimal CLI surface

Initial Mission commands:

```bash
specdev mission create "<objective>"
specdev mission run M00001
specdev mission run M00001 --takeover
specdev mission status M00001
specdev mission pause M00001
specdev mission checkpoint M00001
specdev mission checkpoint M00001 --push
```

`mission status` shows phase, status, branch, revision, current or last child,
pending/completed/blocked counts, next action or blocker, last checkpoint, and
outcome path. There is no initial graph view, `why-next` command, dashboard,
background flag, automatic delivery command, tracker adapter, or hosting
integration.

Discussion commands remain compact:

```bash
specdev discussion "<topic>"
specdev discussion D00001
specdev discussion --list
specdev assignment --from-discussion=D00001
specdev mission create --from-discussion=D00001
```

## Dogfood-driven efficiency rules

The first end-to-end Mission dogfood delivered a small proxy correctly, but it
used several times more model work and durable workflow text than the product
needed. The corrective rule is intentionally simple: **if the approved Mission
can be delivered by one Assignment, do not split it.** Mission is a
user-selected orchestration boundary; it does not imply multiple children.

Mission Design starts with one full-scope child. It creates multiple children
only for one of these concrete reasons:

1. one worker/reviewer Attempt cannot safely hold the implementation;
2. a later unit needs evidence produced by an earlier unit;
3. an intermediate user or operational decision is required; or
4. a unit has meaningfully independent verification or rollback.

File count, architectural layers, and the existence of several Tasks are not
split reasons. When uncertain, keep one Assignment and let a concrete
`follow_up: required` result trigger exception-driven replanning.

For a single-child Mission, the host deterministically derives a concise child
contract from the exact approved Mission hash. It copies Mission acceptance
criteria, references the parent for unchanged scope and authority, and does not
run a separate child-contract author or Brainstorm reviewer. The normal child
implementation review remains required. If that review covers the entire
Mission scope, its contract hash and product-candidate digest still match, and
no later product change exists, the Mission reuses that evidence instead of
running a duplicate convergence review.

For a multi-child Mission, each child contract is a delta, not a rewritten
Mission brainstorm. It records the parent path and approved hash, the child
objective, prerequisites, child-only decisions and risks, focused verification
authority, and child acceptance criteria. Everything else is inherited by
reference. The Assignment graph remains Mission-agnostic; the parent reference
is ordinary contract context supplied by the controller.

Every Assignment freezes a separate review policy when its contract is
approved:

```yaml
brainstorm: optional # optional | required
implementation: required # required | waived
```

The policy defaults apply equally to standalone Assignments. They may be set at
creation or changed on the approval command, but not after approval. A waived
implementation review does not waive evidence: every acceptance result must be
Passed, receipts must be valid with no failed verification, `follow_up` must be
`none`, and structured deviations must be empty. Mission children always use a
required implementation review.

Verification authority also remains local to each Assignment. Referencing a
Mission contract inherits requirements, not executable command authority. A
child uses focused evidence; only the Mission controller may run the one exact
integrated command approved in the Mission contract.

SpecDev also exposes a concurrent, code-read-only Test Audit callable. It scans
the current tests and writes a pruning proposal plus a ready Assignment
contract. Every proposed removal records its rationale, retained protection,
estimated cost saving, and confidence. Completing an audit grants no write
authority. Promotion copies its frozen contract into a normal Assignment, where
the user can edit and approve the exact removals before a worker changes tests.

Attempts record elapsed time and optional provider-reported token usage without
normalizing across providers or imposing budgets. Mission status and outcome
aggregate those observations. Final reviewers are evidence-first, paid calls
are made only after host-side preflight, and temporary baselines or raw provider
result envelopes live in disposable cache when they are no longer needed for
recovery. Final contracts, verdicts, progress, outcomes, receipts, and Attempt
records remain durable.

## Current workflow problems this design removes

- Semantic commands and generic graph steps advancing the same transition
  twice
- Multiple user gates for one approval decision
- Design review followed by plan review
- Per-Task agent, worktree, commit, and review machinery
- Mandatory knowledge-capture lifecycle tails
- Sequential chains of generic reviewers
- Sticky reviewer state and `--autocontinue`
- Whole-context packets and repeated artifact restatement
- Blind provider retries
- Full-suite verification at Task or child-Assignment boundaries
- Runtime transcript retention as durable state
- Generated Mission dependency graphs and rolling graph compilation
- Universal Assignment worktrees and a background Mission daemon
- Structured contract duplication and semantic diff machinery
- Automatic knowledge candidate and promotion systems
- Large status, dashboard, tracker, and delivery surfaces before dogfooding

## External survey

The earlier research compared SpecDev with several active systems. The useful
lessons remain, but they do not justify copying each system's full machinery.

### GitHub Spec Kit

[Spec Kit](https://github.github.com/spec-kit/) demonstrates cross-artifact
analysis, convergence checks, persistent workflow state, and broad agent
integration. Its larger command and document surface is a warning against making
every quality check a separate required phase.

### OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) usefully separates active
change records from living truth. Its archive model reinforces that semantic
CLI operations, rather than skills manually reproducing lifecycle writes,
should own canonical state changes.

### Superpowers

[Superpowers](https://github.com/obra/superpowers) closely matches the desired
interactive Brainstorm followed by automatic delivery. Mandatory subagents and
repeated review loops show how that model can become expensive when applied
uniformly.

### GSD Core

[GSD Core](https://github.com/open-gsd/gsd-core) highlights fresh contexts,
durable continuity files, and verification. SpecDev adopts fresh bounded worker
invocations without creating a context packet for every phase.

### Kiro Specs

[Kiro Specs](https://kiro.dev/docs/cli/v3/specs/) demonstrates portable specs,
autonomous execution, and conditional guidance. SpecDev uses one lifecycle plus
guide selection rather than separate workflow implementations by work kind.

### BMAD

[BMAD](https://github.com/bmad-code-org/BMAD-METHOD) shows the value of adapting
planning depth. Its persona and workflow count reinforces the decision to use
two logical profiles and prompt-defined temporary work.

### Microsoft Conductor

[Microsoft Conductor](https://github.com/microsoft/conductor) demonstrates
deterministic graph routing, reusable subworkflows, human gates, model effort,
and versioned execution. SpecDev adopts static graphs and effort settings while
deferring general parallel orchestration.

### GitHub Agentic Workflows

[GitHub Agentic Workflows](https://github.github.com/gh-aw/) demonstrates
read-only reasoning separated from validated writes, protected operations, and
cost controls. SpecDev applies a narrow read-only reviewer boundary without
building a general sandbox framework.

### OpenAI Symphony

[OpenAI Symphony](https://github.com/openai/symphony) is the strongest reference
for durable multi-item scheduling, isolated workspaces, single claims, bounded
concurrency, retry policy, and operator-visible state. SpecDev adopts stable
work identity and one controller, but deliberately starts with a sequential
foreground Mission rather than a persistent issue-board scheduler.

## Product strength

SpecDev's differentiator is not the number of prompts, agents, or artifacts. It
is **contract-governed orchestration**:

```text
interactive intent
  -> reviewed contract and visible divergence
  -> explicit delegated authority
  -> bounded automatic Assignment work
  -> evidence-aware completion
  -> durable searchable record
```

The combination of one trusted user gate, reusable Assignment workflow,
recoverable Mission state, concurrent code-read-only Discussions, curated
guidance, and disposable local search is more distinctive than any individual
agent prompt.

## Implementation roadmap

### Slice 1: Assignment vNext

- Remove duplicate transitions and gates.
- Keep one readable contract and one user approval.
- Add Brainstorm divergence verdict.
- Add committed worker/reviewer profiles with model, effort, and timeout.
- Combine Design and Implementation into one normal worker Attempt.
- Add minimal result envelopes, targeted verification receipts, and one
  reviewer rerun.
- Remove `--autocontinue`, sticky review state, Design review, Task subagent
  defaults, and mandatory knowledge capture.

### Slice 2: Discussion callable

- Convert Discussion from a focused workflow to a callable graph.
- Stop runtime registry rewrites.
- Add concurrent ID-safe create, resume, list, optional review, and completion.
- Record start/completion revisions and promotion provenance.
- Prove a Discussion can proceed while an Assignment or Mission remains
  focused.

### Slice 3: Knowledge repair

- Make SQLite disposable and deterministic.
- Add atomic rebuild and automatic stale detection.
- Improve OR-default query normalization and coverage-aware ranking.
- Add authority and completion-status filtering.
- Remove candidate and processed-ledger machinery from the target design.

### Slice 4: Sequential Mission v1

- Add Mission folders, static lifecycle, branch, and ordered Assignment queue.
- Reuse the Assignment graph with mandatory child Brainstorm review and Mission
  approval provenance.
- Add foreground run, status, pause, takeover, checkpoint, exception-driven
  replanning, final review, and one authorized integrated verification.
- Leave delivery to normal Git commands.

### Manual dogfooding

Do not build a benchmark harness first. Use:

1. One real Assignment vNext change.
2. One concurrent Discussion while other work is focused.
3. One genuinely decomposable sequential Mission.

Record whether restart worked, review exposed material divergence, automation
respected the contract, verification repeated unnecessarily, and the final
record was useful. A Mission is successful only if it provides meaningful
context isolation, recovery, or evidence benefits over one large Assignment.

## Explicitly deferred

- Parallel Mission Assignments and worktree leasing
- Background or distributed Mission runners
- Dynamic dependency graphs and readiness schedulers
- Automatic merge, pull request, tracker, or delivery integrations
- General capability sandboxing and file ownership
- Cross-provider token budgets and adaptive model selection
- Blind retries, automatic salvage, and database-style process recovery
- Vector search and external knowledge stores
- Knowledge candidate, distillation, and promotion workflows
- Guide marketplace, live prompt downloads, and automatic project-guide writing
- Dashboard and formal comparative benchmark suite

These features should be added only after real usage demonstrates that the
simpler architecture cannot meet a concrete need.

## Implementation anchor

The next implementation design should specify Slice 1 contracts first:

1. Exact `assignment-lifecycle` nodes and semantic transition ownership.
2. Canonical Assignment artifact templates and result frontmatter.
3. Brainstorm baseline, review, divergence, and approval behavior.
4. Worker/reviewer profile resolution and provider adapters.
5. Verification receipts, continuation Attempts, and completion rules.

Discussion callable and Mission lifecycle specifications should then reuse those
same review, profile, result, and recovery contracts rather than introducing
parallel implementations.
