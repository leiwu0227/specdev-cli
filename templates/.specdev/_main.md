# SpecDev workflow

SpecDev treats tracked `.specdev/` as portable workflow state and the current
coding CLI as the interactive worker. Run the Node.js CLI directly as `specdev
<command>`; never install or invoke it with Python tooling.

When `.specdev/cache/bin/specdev` exists, run workflow commands through that
workspace-local wrapper so a stale global installation cannot drive newer
artifacts. Fall back to `specdev` on PATH only when the wrapper is absent.

## Start here

1. Read `.specdev/project_notes/big_picture.md` and repository instructions.
2. Classify the user's request before creating anything: Direct, Adhoc,
   Discussion, Assignment, or Mission. Recommend a lane when useful, but let the
   user select it. Never silently turn every request into an Assignment.
3. Run `specdev next --json` only when resuming a focused RippleGraph workflow.
4. For explicit identities use `specdev mission status M00001` or `specdev
discussion D00001`.
5. Announce every subtask with `Specdev: <action>`.

Questions, explanations, status checks, and read-only inspection are **Direct**:
answer them without a graph or log. A user instruction such as “directly”, “just
do it”, “skip SpecDev”, or “no assignment” rules out an Assignment unless the
user later chooses one.

Do not edit `.ripplegraph/` manually. Lifecycle state and approval events belong
to RippleGraph while work is non-terminal; revisions and diffs belong to Git;
contracts, outcomes, and receipts are the small durable human record. Successful
Mission and standalone Assignment completion removes the terminal run and its
owned Attempt records after their compact activity summary has been preserved.
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
- **Adhoc:** one user-selected bounded repository change with no graph,
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
- Adhoc refuses a dirty start until the user inspects, separately checkpoints,
  or explicitly adopts every existing change. Assignment enforces the same
  product-tree decision immediately before implementation.
- SpecDev-owned delivery commits carry `SpecDev-*` trailers. Adhoc and
  standalone Assignment create one final delivery commit; Mission checkpoints,
  child deliveries, integrations, and completion identify their commit type.
- Reviewers inspect and report; they never repair tracked code.
- Never run a full suite when narrower evidence answers the current question.
  Repository confirmation rules always take precedence.
- Do not create worktrees for normal Assignments, sequential Mission children,
  Missions, or Discussions. Only the Mission controller may lease the validated
  `.specdev/worktrees/slot-N` pool for a parallel wave.
- Raw provider output, PID state, SQLite, and scratch data belong in ignored
  `cache/`; ordinary interrupted source can be inspected and repaired.
- A blocked Assignment worker preserves its result and returns a blocked
  outcome. Finish its artifacts and rerun to resume without another provider
  call, or use `specdev implement --retry-worker` to request one explicitly.

See `_index.md` for paths and `_guides/workflow.md` for the concise lifecycle.
