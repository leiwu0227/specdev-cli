# Assignment contract

Kind: feature

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Deliver the standalone Assignment terminal-receipt slice of
`.specdev/missions/M00002_make-live-specdev-workflows-visibly-progressive-/brainstorm/contract.md`,
approved at hash `f807741f24148b58f7bba60216c0686c95ce99afd2fa7cd40d13d2670f0cfbd2`.
All unchanged Mission behavior and authority are inherited. Prerequisite outcome
`.specdev/assignments/00039_add-bounded-structured-progress-for-long-running/outcome.md`
establishes the bounded structured-output conventions this child may reuse.

## Scope and non-goals

- In scope: deterministic human and JSON delivery receipts for successful
  standalone `specdev implement`, including resumed completion.
- Non-goals: the Mission's status slice, further Attempt-progress behavior,
  Mission delivery receipts, and every inherited Mission non-goal.

## Expected behavior

Successful first-run and resumed completion project one validated receipt with
Assignment and contract identity, review/divergence result, delivery commit,
acceptance and verification summaries, grouped changed project paths,
unresolved risks, durable artifact paths, and final worktree cleanliness.

## Important decisions

- Build the receipt once from durable Assignment artifacts and the existing Git
  delivery boundary, then project that object into human and JSON output.
- Resume reconstructs delivery without another provider call or delivery
  commit; missing or ambiguous evidence remains explicit.

## Constraints and invariants

All Mission constraints and invariants are inherited unchanged. This child may
observe existing delivery state but must not alter approval, review,
verification, recovery, lifecycle, or commit authority.

## Delegated and reserved authority

- Delegated: the receipt schema, aggregation boundary, human formatting, JSON
  shape, and changed-path grouping within the approved Mission contract.
- Reserved for the user: all authority reserved by the Mission, plus any
  expansion into status, retention, cleanup, or non-standalone delivery flows.

## Risks and assumptions

Dirty or resumed candidates can make Git-derived ownership ambiguous, and
older artifacts may be incomplete; the receipt must preserve those conditions
rather than infer success or ownership. The prerequisite outcome is assumed to
remain integrated and available for shared bounded-output conventions.

## Verification authority

- Focused receipt tests are allowed after repository instructions are
  satisfied.
- The Mission's final integrated command and every other test command retain
  their existing Mission authority and are not delegated to this child.

## Acceptance criteria

- AC-1: Successful standalone Assignment automation emits deterministic human
  and JSON projections of one validated receipt containing contract/review
  identity, delivery commit, acceptance and verification results, grouped
  changed project paths, unresolved risks, durable artifact paths, and final
  worktree cleanliness.
- AC-2: Resumed completion reconstructs the same receipt without another
  provider call or delivery commit, while missing, failed, skipped, blocked, or
  ambiguous evidence remains visibly non-successful or incomplete.
