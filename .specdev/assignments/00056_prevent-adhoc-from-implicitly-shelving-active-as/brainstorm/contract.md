# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Adhoc a temporary, non-terminal detour when a standalone Assignment is
already active. Starting an Adhoc must never implicitly shelf, abandon, replace,
or otherwise terminate that Assignment; safe pre-implementation Assignment
state should remain resumable under the same identity after the Adhoc ends.

## Scope and non-goals

- In scope: Adhoc start/finish/cancel ownership classification for an active
  standalone Assignment, lifecycle and Git-boundary safety checks, actionable
  blocking output, and authoritative generated workflow/skill guidance.
- Non-goals: concurrent Assignment implementation and Adhoc execution, changing
  Mission semantics, moving Assignment product changes into an Adhoc delivery,
  rebasing an established Assignment Git boundary, reactivating shelved work, or
  adding a general scheduler/worktree manager.

## Expected behavior

When the focused standalone Assignment has no implementation Git boundary, no
live or ambiguous worker/reviewer Attempt, and no dirty product paths, `specdev
adhoc start` may begin without changing the Assignment ID, run, focus, lifecycle,
or artifacts. Assignment-owned workflow paths are classified as preserved state
outside Adhoc ownership. Finishing the Adhoc creates only its bounded delivery
commit and receipt; cancelling leaves its source changes untouched. Either path
leaves the original Assignment active and resumable under the same identity.

If the Assignment has an established implementation Git boundary, a live or
ambiguous Attempt, dirty product work, or workflow state that cannot be assigned
safely, Adhoc start blocks before creating state. Human and JSON output explain
the conflicting boundary or owner and offer non-terminal recovery actions;
neither the CLI nor installed agent guidance may select shelving on the user's
behalf.

## Important decisions

- Shelving remains an explicit user-selected terminal operation. It is not a
  pause mechanism or an automatic prerequisite for Adhoc.
- Coexistence is intentionally limited to the safe interval before Assignment
  implementation establishes its Git boundary. The subsequent Adhoc commit can
  then become part of the repository state from which implementation starts.
- “Does not want an Assignment” in Adhoc guidance means the bounded detour
  should not become a separate Assignment; it does not reject or terminate an
  unrelated Assignment already in progress.

## Constraints and invariants

- An Adhoc delivery commit must exclude the preserved Assignment contract,
  status, focus, RippleGraph run, Attempt records, and other Assignment-owned
  workflow paths, including pre-existing lifecycle cleanup outside Adhoc scope.
- Adhoc must retain its exact-manifest, unchanged-HEAD, compare-and-swap, and
  recovery guarantees. Assignment coexistence cannot weaken dirty-product-path
  inspection or make `--adopt-dirty` a way to absorb Assignment work.
- Assignment commands that implement or advance product work remain unavailable
  while an Adhoc is active; no live worker or reviewer may overlap the detour.
- Existing Discussion and Test Audit coexistence behavior remains compatible.

## Delegated and reserved authority

- Delegated: the internal active-Assignment resolver, persisted ownership facts,
  classification labels, bounded diagnostics, and focused regression fixtures.
- Reserved for the user: explicitly shelving or abandoning an Assignment,
  resolving ambiguous dirty work, authorizing verification, and approving any
  broader boundary-rebase or concurrent-execution design.

## Risks and assumptions

The main risk is misclassifying Assignment-owned workflow state as Adhoc product
work, or allowing an Adhoc commit after implementation has bound the Assignment
to an earlier HEAD. The safe case assumes the active Assignment is quiescent and
has not begun implementation; uncertain ownership must block without mutation.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: With a focused active standalone Assignment that has no implementation
  Git boundary, live/ambiguous Attempts, or dirty product paths, Adhoc start
  succeeds while preserving the Assignment ID, run, focus, lifecycle, and
  workflow artifacts as explicitly classified non-Adhoc state.
- AC-2: Adhoc finish and cancel preserve that Assignment for continuation under
  the same identity; the delivery commit contains only authorized Adhoc paths
  and its receipt, and no shelf artifact, terminal transition, successor, or
  Assignment-owned path is created or committed.
- AC-3: Established Assignment boundaries, live/ambiguous Attempts, dirty
  product work, and uncertain ownership block Adhoc before mutation with
  actionable human/JSON diagnostics that never prescribe implicit shelving;
  authoritative generated guidance states the same rule while retaining
  existing Discussion/Test Audit and transactional Adhoc guarantees.
