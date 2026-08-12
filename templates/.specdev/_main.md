# SpecDev workflow

SpecDev treats tracked `.specdev/` as portable workflow state and the current
coding CLI as the interactive worker. Run the Node.js CLI directly as `specdev
<command>`; never install or invoke it with Python tooling.

Resolve the launcher once per shell/session with this copyable contract. It
selects an executable workspace wrapper when present and otherwise resolves the
supported PATH command without first attempting a missing path:

```sh
if [ -x .specdev/cache/bin/specdev ]; then
  SPECDEV_LAUNCHER=.specdev/cache/bin/specdev
else
  SPECDEV_LAUNCHER="$(command -v specdev)"
fi
[ -n "$SPECDEV_LAUNCHER" ] || { echo "specdev launcher not found" >&2; exit 127; }
"$SPECDEV_LAUNCHER" <command>
```

## Start here

1. Read `.specdev/project_notes/big_picture.md` and repository instructions.
2. Classify the user's request before creating anything: Direct, Adhoc,
   Discussion, Assignment, or Mission. Recommend a lane when useful, but let the
   user select it. Never silently turn every request into an Assignment.
3. Run `specdev next --json` only when resuming a focused RippleGraph workflow.
4. For explicit identities use `specdev mission status M00001` or `specdev
discussion D00001`.
5. Announce meaningful phase transitions with `Specdev: <action>`. Announce
   plan changes, failed verification, and blockers immediately; repeated
   read-only probes within an announced phase need no additional message.

Questions, explanations, status checks, and read-only inspection are **Direct**:
answer them without a graph or log. A user instruction such as “directly”, “just
do it”, “skip SpecDev”, or “no assignment” rules out an Assignment unless the
user later chooses one.

An explicit request to write a bounded coordination or handoff note into another
repository is an auxiliary write, not an implicit Adhoc selection or a reason to
create SpecDev state in the active repository. Write only that note, honor the
destination repository's instructions, and report the write normally. If the
request changes the destination repository's product, runtime, or workflow
state, or explicitly requests SpecDev governance there, re-anchor in that
repository and classify the work there before editing.

Do not edit `.ripplegraph/` manually. Lifecycle state and approval events belong
to RippleGraph while work is non-terminal; revisions and diffs belong to Git;
contracts, outcomes, and receipts are the small durable human record. Successful
Mission and standalone Assignment completion removes the terminal run and its
owned Attempt records after their compact activity summary has been preserved.
Attempt execution records use IDs such as `Attempt-00001`; they are temporary
worker, reviewer, or controller invocations, not Assignment identities. Legacy
`ATT-*` records may remain while older in-flight work resumes.
Assignment and Mission transitions are owned by their semantic commands;
generic `specdev step`, `decide`, and `action` cannot advance those graphs.

For project-facing review, prioritize `missions/` and `assignments/`: they hold
the approved authority, delivery evidence, and outcomes. Installed workflow
packages and skills are durable infrastructure. RippleGraph checkpoints and
process records are temporary recovery infrastructure for non-terminal work;
human summaries should count or group them instead of enumerating every file.

When an unfamiliar repository-specific failure or recurring hazard appears,
search living knowledge with `specdev knowledge search "<keyword bag>"`. Use
`--include-stale` only to recover older guidance and verify it before relying on
it. `specdev knowledge distill` is an optional read-only brief for the current
coding CLI; it never launches a distillation agent or rewrites knowledge by
itself.

## Work types

- **Direct:** questions, explanations, status, and read-only inspection. No
  workflow and no durable receipt.
- **Adhoc:** one explicitly user-selected bounded repository change with no graph,
  scheduler, subagent, worktree, or approval gate. It records one concise
  receipt and one final Git commit. Start with `specdev adhoc start "<scope>"`.
- **Assignment:** one readable contract, one user approval, then automatic
  Design + Implementation + evidence + review.
- **Mission:** a foreground controller on a dedicated branch. It uses the
  normal worktree for sequential children and automatically leases up to three
  ignored worktrees for an already-justified independent child wave. Mission is
  user-selected and does not imply multiple children.
- **Discussion:** a concurrent code-read-only RippleGraph callable that writes
  proposal/design artifacts and may later be promoted to fresh work.
- **Test Audit:** a concurrent code-read-only callable that proposes exact test
  pruning and a ready Assignment contract; it never removes tests itself.

Only one focused Assignment or Mission scheduler exists. Discussion and Test
Audit callables may coexist because their checkpoints are isolated. Adhoc is not
a scheduler, but only one may be active in a worktree.

## Hard rules

- The foreground coding CLI authors Brainstorm with the user; do not spawn a
  separate Brainstorm author for standalone work.
- Assignment Brainstorm review defaults to optional and implementation review
  defaults to required. The user may freeze another supported policy at
  contract approval. A review waiver never waives acceptance evidence.
- Mission Brainstorm review is optional and never approves the contract.
  Multi-child Mission contracts receive review; a deterministic full-scope
  single child reuses the approved parent authority without another Brainstorm
  author or reviewer.
- Approval binds the exact final contract hash. Editing it invalidates approval.
- Before requesting Assignment or Mission contract approval, show the exact
  contract path and hash plus a concise 2-4 bullet preview covering objective,
  scope, and key acceptance criteria. The preview never replaces the contract.
- Adhoc classifies dirty product paths separately from independent Discussion
  and Test Audit state. Concurrent callable state is preserved outside Adhoc
  ownership; dirty product paths still require inspection, a separate
  checkpoint, or explicit adoption. Assignment enforces the same product-tree
  decision immediately before implementation.
- SpecDev-owned delivery commits carry `SpecDev-*` trailers. Adhoc and
  standalone Assignment create one final delivery commit; Mission checkpoints,
  child deliveries, integrations, and completion identify their commit type.
- Reviewers inspect and report; they never repair tracked code.
- Only a review launched through `specdev reviewloop` can authorize a workflow
  transition. A coding CLI's native review command is advisory because it does
  not receive or validate the strict SpecDev result envelope.
- Never run a full suite when narrower evidence answers the current question.
  Repository confirmation rules always take precedence.
- Do not create worktrees for normal Assignments, sequential Mission children,
  Missions, or Discussions. Only the Mission controller may lease the validated
  `.specdev/worktrees/slot-N` pool for a parallel wave.
- Raw provider output, PID state, SQLite, and scratch data belong in ignored
  `cache/`; ordinary interrupted source can be inspected and repaired.
- A reviewed Mission child that only exceeds automatic authority pauses at an
  exact user-reapproval identity. Repeated `mission run` and `mission status`
  calls are provider-free until the user runs the displayed
  `mission approve-divergence` or `mission reject-divergence` command.
- A blocked Assignment worker preserves its result and returns a blocked
  outcome. Finish its artifacts and rerun to resume without another provider
  call, or use `specdev implement --retry-worker` to request one explicitly.

See `_index.md` for paths and `_guides/workflow.md` for the concise lifecycle.
