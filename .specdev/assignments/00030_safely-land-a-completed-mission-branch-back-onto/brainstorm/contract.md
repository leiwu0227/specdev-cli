# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Complete the Git lifecycle that SpecDev starts when it creates a dedicated
Mission branch. After the Mission completion checkpoint, land its final revision
onto the recorded originating branch automatically when a clean fast-forward is
provably safe. Otherwise preserve the completed branch and present an explicit,
actionable user decision instead of silently ending on the Mission branch.

## Scope and non-goals

- In scope: completed-Mission landing classification, safe automatic
  fast-forward, an idempotent explicit landing command, Mission status/output,
  and focused regression coverage.
- Non-goals: changing standalone Assignment delivery, child Assignment
  integration, Mission decomposition, remote synchronization, pull-request
  creation, or adding a general Git branch manager.

## Expected behavior

- After the completion commit, SpecDev automatically switches to the recorded
  base branch and fast-forwards it to the Mission final revision only when the
  worktree is clean, the current branch is the Mission branch, the base branch
  exists locally, and its tip is an ancestor of the final revision.
- If the base is already at or contains the final revision, landing is reported
  as already complete without changing Git state.
- Dirty state, a missing base branch, another checked-out branch, or divergent
  history leaves the completed Mission branch and commits untouched. Completion
  output and `mission status` show the exact condition and structured choices
  to inspect, land later, or deliberately leave the branch.
- `specdev mission land M00001` retries the same fast-forward-only operation
  safely and idempotently after the user resolves the condition.

## Important decisions

- The Mission is semantically completed before landing; inability to land does
  not rerun work or change the successful Mission outcome.
- Automatic landing is limited to a clean fast-forward because SpecDev created
  the Mission branch as an internal execution mechanism.
- Non-fast-forward integration remains an explicit user-owned Git decision.
  SpecDev never silently rebases or creates a merge commit.

## Constraints and invariants

- The recorded `base_branch`, `base_revision`, Mission branch, and final
  completion revision are the authoritative landing inputs.
- Landing must be crash-safe and repeatable: rerunning after a completed switch
  or fast-forward reports the derived current state without duplicating commits.
- A failed or ineligible landing attempt does not discard commits, rewrite
  history, stage files, or move either branch.
- SpecDev does not automatically push, fetch, delete branches, or mutate remote
  refs.
- Existing Mission final verification, completion checkpoint, child integration,
  and runtime compaction behavior remains unchanged.

## Delegated and reserved authority

- Delegated: choose the internal landing-state model, command output shape,
  concise human interaction wording, and focused fixture organization.
- Reserved for the user: resolving divergence, selecting merge versus rebase,
  pushing, deleting branches, overriding dirty-state safety, or changing the
  recorded destination branch.

## Risks and assumptions

The main risk is moving a base branch when its history or working tree no longer
matches the Mission's recorded assumptions. Eligibility must therefore be
derived immediately before each Git mutation and failures must preserve the
completed Mission revision. The base branch is assumed to be a local branch
recorded at Mission approval.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A completed Mission with a clean worktree and an unchanged/ancestor base
  automatically returns to that base branch and fast-forwards it exactly to the
  Mission final revision.
- AC-2: Dirty, missing, wrong-branch, and diverged cases preserve refs and files,
  report distinct pending-landing reasons and actionable choices, and never
  perform a merge, rebase, fetch, push, or deletion.
- AC-3: `specdev mission land <id>` and `mission status` derive and report
  pending, landed, and already-landed states idempotently, including recovery
  after interruption between branch switch and fast-forward.
