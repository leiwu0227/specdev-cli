# SpecDev CLI

SpecDev is a Node.js CLI for contract-governed coding-agent workflows. The
tracked `.specdev/` folder is portable state; the current coding CLI is the
interactive worker, while configured subprocess agents perform bounded
automatic work and review.

The workflow is deliberately small at the project boundary. SpecDev first
classifies the request; it does not silently turn every user message into an
Assignment:

- no state for questions, explanations, status, or read-only inspection;
- one receipt and final commit for a user-selected bounded Adhoc change;
- one readable contract and one explicit user approval before code changes;
- one Assignment when contracted delivery is needed, instead of speculative decomposition;
- automatic implementation and review with durable, restartable evidence;
- static-wave Mission parallelism only for already-independent children; and
- authoritative Markdown knowledge with a disposable SQLite search index.

| Work type  | Purpose                                | Product writes | Concurrency                                             |
| ---------- | -------------------------------------- | -------------- | ------------------------------------------------------- |
| Direct     | Answer, explain, inspect, or report    | No             | No workflow or log                                      |
| Adhoc      | Deliver one bounded user-selected edit | Yes            | One active per worktree; no graph                       |
| Assignment | Deliver one approved contracted change | Yes            | One focused workflow                                    |
| Mission    | Deliver a larger user-chosen objective | Yes            | Foreground controller; up to three independent children |
| Discussion | Explore and preserve a future design   | No             | May coexist with focused work                           |
| Test Audit | Propose safe test pruning              | No             | May coexist with focused work                           |

## Install

Node.js 22.13 or newer is required.

```bash
npm install -g github:leiwu0227/specdev-cli
specdev init
```

For an existing SpecDev repository, run `specdev update`. SpecDev is a Node.js
CLI and is never installed or invoked through Python tooling. See
[QUICKSTART.md](QUICKSTART.md) for the first end-to-end workflow.

`specdev update` refreshes managed templates, installs immutable versioned
RippleGraph packages, and preserves project-owned notes, guides, and work.
After initialization/update, coding agents should prefer the generated ignored
`.specdev/cache/bin/specdev` wrapper for workflow commands; it prevents a stale
global executable from driving the workspace.

## Direct and Adhoc work

Questions, explanations, status requests, and read-only inspection are Direct:
answer them without a graph or durable log. For a concrete bounded edit where a
contract and review loop would be ceremony, the user may select Adhoc:

```bash
specdev adhoc start "repair one help message"
# make the bounded change directly
specdev adhoc finish --outcome="Corrected the help text" --verification="Inspected CLI output"
specdev adhoc show AH-20260722T120000000Z-abcd
```

Adhoc requires an existing Git HEAD. A dirty start blocks until the user
inspects it, commits it separately, or explicitly reruns with `--adopt-dirty`.
It has no RippleGraph run, scheduler, worktree, subagent, or approval gate.
Finish refuses an intervening HEAD change, writes one concise immutable receipt
under `.specdev/adhoc/`, and creates one commit with `SpecDev-Adhoc` and
`SpecDev-Commit-Type: delivery` trailers. `specdev adhoc cancel` removes only
the ignored active marker and leaves source changes untouched.
Individual receipts are not indexed into `knowledge.sqlite`; the indexed
`knowledge/workflow/adhoc-history.md` note teaches agents to search them with
`rg`, Git commit messages/trailers, and `specdev adhoc show` when needed.

## Assignment

```bash
specdev assignment "repair keyword search"
# Collaborate with the user in brainstorm/contract.md
specdev checkpoint brainstorm
specdev reviewloop brainstorm       # optional
specdev approve brainstorm          # one explicit user gate
specdev implement                   # plan + code + evidence + review
```

Review policy is separate from the behavioral contract. Defaults are
`brainstorm: optional` and `implementation: required`; set supported overrides
with `--brainstorm-review=required|optional` and
`--implementation-review=required|waived` at creation or approval. Approval
freezes the policy. A waived implementation review still requires every
acceptance criterion and receipt to pass, with no deviations or follow-up.

Keep `brainstorm/contract.md` proportional: reference project context instead of
restating it, capture only change-specific decisions and constraints, and use
the fewest independent observable acceptance criteria (normally 1-3 for a small
change and rarely more than 5). Tasks, file lists, repository conventions, and
generic quality checks belong in the plan or existing guidance.

An Assignment has one readable contract, one hash-bound approval, one normal
worker Attempt for Design and Implementation, and one reviewer. A first
blocking implementation verdict starts one continuation worker; the same
reviewer verifies once. There is no routine final user gate.
If the worker itself returns blocked, `specdev implement` reports a blocked
outcome and preserves its work. Rerunning does not silently spend another agent
call: complete the preserved delivery artifacts and rerun to reuse them, or use
`specdev implement --retry-worker` to explicitly launch a fresh worker.
If review findings changed the contract after checkpoint, run `specdev
checkpoint brainstorm` once more to present the final hash before approval.
Before asking for approval, show the exact contract path and hash plus the
bounded CLI preview: objective, in-scope change, and up to two acceptance
criteria. The preview helps the user decide but does not replace the contract.
Immediately before implementation, SpecDev records a Git boundary. Existing
product changes require the same inspect/checkpoint/explicit-adoption decision
as Adhoc. Successful standalone delivery creates one host-owned commit carrying
`SpecDev-Assignment` and `SpecDev-Commit-Type: delivery` trailers; Mission child
commits remain owned by the Mission controller.

Only reviews launched through `specdev reviewloop` can authorize SpecDev
transitions. Native Codex, Claude, or Cursor review sessions remain useful
advice, but their ordinary Markdown is not treated as a workflow verdict. Agent
results must begin with the strict YAML-frontmatter envelope and contain a
non-empty required section; one format-only resubmission is allowed, after
which the workflow remains blocked.

```text
.specdev/assignments/00042_keyword-search/
  brainstorm/contract.md
  design/plan.md
  implementation/progress.json
  review/                       # only when review runs
  outcome.md
  status.json
```

## Concurrent Discussion

```bash
specdev discussion "explore a new search API"
specdev discussion D00001
specdev reviewloop discussion --discussion=D00001   # optional
specdev discussion D00001 --complete
specdev assignment --from-discussion=D00001
specdev mission create --from-discussion=D00001
```

A Discussion is a RippleGraph callable. It may coexist with a focused
Assignment or Mission, may inspect the repository, and writes only its proposal,
design, and optional verdict. It never modifies product code. Completion freezes
the proposal/design hash; restore those artifacts or create a new Discussion if
they need to change before promotion.

## Mission

```bash
specdev mission create "repair search end to end"
specdev mission run M00001
specdev reviewloop mission --mission=M00001   # optional before approval
specdev mission run M00001 --approve
specdev mission status M00001
specdev mission land M00001
specdev mission pause M00001
specdev mission run M00001 --takeover
specdev mission checkpoint M00001 [--push]
```

A Mission runs in the foreground on a dedicated Git branch. The user chooses
Mission; SpecDev does not infer it from size. Mission Design defaults to one
full-scope child and splits only for a worker context
limit, an information dependency, an intermediate decision, or independent
verification/rollback. The single child contract and acceptance criteria are
derived from the approved Mission without duplicate author or Brainstorm-review
calls. Its required implementation review is reused for Mission convergence
when scope and candidate digest are unchanged. Multi-child contracts are
concise deltas and receive Brainstorm review. A child `follow_up: required`, a
Mission-review finding, or a failed final receipt invokes the worker profile to
revise only the remaining queue; completed work and runtime-owned IDs are
protected.
Explicit Mission approval creates the initial portable checkpoint on that
branch before Mission Design starts.
If a child review blocks for user direction, `mission run <id> --override-review`
applies only when resuming that current child approval and is recorded in that
child’s approval event; it never carries to later children.

`mission status` reports the Mission branch revision, current/last child,
controller liveness, blocker/next action, and last checkpoint. Pause the Mission
before running an unrelated standalone Assignment. Checkpoints commit only when
substantive portable changes exist; `--push` pushes only the Mission branch.
Successful final verification creates one completion checkpoint automatically,
so the reported final revision contains the verified product and portable
Mission state. SpecDev then returns to the recorded base branch and
fast-forwards it exactly to that revision only when the worktree is clean, the
Mission branch is checked out, the base exists locally, and the update is a
fast-forward. `mission status` reports landed or a distinct pending reason with
inspect, retry, and leave-as-is choices; `mission land <id>` safely retries the
same idempotent operation. SpecDev never resolves divergence with a merge or
rebase and never fetches, pushes, or deletes a branch while landing.
Active, paused, blocked, and interrupted work keeps its complete
RippleGraph checkpoint and Attempt records for recovery. After successful
completion, SpecDev records terminal state and aggregate activity in
the Mission/Assignment artifacts, then removes the completed run and its owned
Attempt records before the completion commit. Completed work therefore remains
portable as project documents rather than retained execution infrastructure.
New execution IDs use the explicit `Attempt-00001` form. Legacy `ATT-*` records
remain readable so interrupted work can resume after an update.
For an already-justified multi-child plan, Mission Design assigns static waves.
Semantically independent children in one wave automatically run in up to three
validated `.specdev/worktrees/slot-N` worktrees. Completed branches integrate
in declared order as soon as the next child is ready; the controller never asks
the user for a concurrency count and never splits solely for speed. A setup
failure before launch falls back to sequential execution. An integration
conflict stops new launches: resolve and stage the conflicted files, then rerun
the Mission, or abort the cherry-pick to retry the delivery.

Integration uses a durable two-phase marker around the cherry-pick and commit.
After a restart, SpecDev either retries an unapplied delivery, finishes the
known staged delivery, or recognizes its completed integration commit. It
refuses to commit staged paths that do not belong to that child delivery or the
parent Mission state.

On another machine, fetch and switch to that pushed Mission branch before
running `mission status` or `mission run`; SpecDev will use an existing fetched
`origin/<mission-branch>` as the tracking source and never fetches by itself.

Mission status and outcome separate orchestration records from provider agent
Attempts and classify provider outcomes as completed, failed, blocked,
interrupted, or running. They also report elapsed time and optional
provider-reported token usage. These are observations only, not cross-provider
budgets.

Human-facing workspace summaries list bounded product paths and group portable
Mission/Assignment artifacts by work item. Installed workflows and skills
remain necessary. RippleGraph state and process records remain necessary only
for non-terminal work, and their individual paths are collapsed into one
infrastructure count. JSON output retains exact dirty paths for automation.

## Test maintenance audit

```bash
specdev test-audit "slow integration tests"
specdev test-audit TA00001
specdev test-audit TA00001 --complete
specdev assignment --from-test-audit=TA00001
```

A Test Audit can coexist with focused work because it is code-read-only. It
produces an exact pruning proposal and a ready Assignment contract containing
rationale, retained protection, expected cost saving, and confidence. The audit
never deletes tests; promotion enters the normal hash-bound Assignment approval
before a worker receives write authority.

## Agent profiles and guides

Committed repository preferences live in `.specdev/agents.yaml`:

```yaml
worker:
  provider: codex
  model: gpt-5
  effort: high
  network: false
  timeout: 60m

reviewer:
  provider: claude
  model: opus
  effort: high
  timeout: 20m
```

Optional machine overrides go in ignored
`.specdev/cache/agents.local.yaml`. Supported providers use safe worker or
read-only reviewer modes; dangerous permission-bypass flags are not used. A
Codex worker can opt into network access with `network: true` when its approved
work requires package access, local services, or network-backed tests. Network
access is off by default and is not available to reviewer profiles.

Provider transcripts are written under `.specdev/cache/attempts/`. The CLI
prints Attempt start, heartbeat, and finish messages instead of streaming noisy
raw provider output. Set `SPECDEV_AGENT_STREAM=1` when live provider output is
useful for debugging.

Curated guidance lives under `.specdev/guides/library/`; project maintainers own
`.specdev/guides/project/`. Normally at most three guides are selected for one
invocation.

## Knowledge search

```bash
specdev knowledge rebuild
specdev knowledge search "keyword query parser"
specdev knowledge search "old electron workaround" --include-stale
specdev knowledge search "old workflow" --scope=history
specdev knowledge distill
```

Markdown is durable authority. `cache/knowledge.sqlite` is a disposable local
FTS cache rebuilt atomically when missing or stale. Bag-of-words searches use OR
eligibility by default, rank term coverage before BM25, and exclude incomplete
work from default results. FAQs may carry `verified_at`, `review_after`,
`applies_to`, `sources`, and `status`; stale FAQs are excluded unless
`--include-stale` is explicit, while superseded entries require a broader
history scope and may point to their replacement with `superseded_by`.

`knowledge distill` does not start a workflow or spawn an agent. It gives the
current coding CLI a bounded list of completed Assignment/Mission outcomes and
hash-valid completed Discussion designs not yet cited by active knowledge, plus
stale FAQs requiring review. The CLI classifies reusable findings, updates or
creates curated Markdown without duplicating topics, cites its durable sources,
and rebuilds SQLite. Source citations replace a separate processed ledger.

## Durable and local state

RippleGraph owns lifecycle position and approval events. Git owns revisions and
diffs. Contracts, plans, outcomes, and verification receipts are small portable
records. Checkpoints and Attempt records remain portable only while work may
need recovery, then are compacted after successful Mission or standalone
Assignment completion. Raw provider logs, PIDs, SQLite, and future worktree slots
stay under ignored `cache/` or `worktrees/`.

SpecDev-owned authoritative commits use `SpecDev-*` trailers. Adhoc and
standalone Assignment use delivery commits; Mission uses checkpoint,
child-delivery, integration, and completion commit types. Hashes are derived
from Git when needed rather than embedded into artifacts inside their own
commit.

Run `specdev help` for the compact command list.

## License

MIT
