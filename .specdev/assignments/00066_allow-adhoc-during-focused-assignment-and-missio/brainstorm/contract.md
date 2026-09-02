# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Implement the remaining Roadmap gap by allowing an independent Adhoc detour
while an Assignment or Mission is forming its contract, awaiting approval, or
otherwise quiescent before product execution. The focused workflow must remain
the same durable owner and resume only after the detour's repository impact has
been revalidated.

## Scope and non-goals

- In scope: Adhoc start/finish/cancel coexistence with standalone Assignment and
  Mission ownership at safe pre-execution positions; preservation and path
  classification for the complete focused workflow; focused-command guards;
  post-detour revalidation state and recovery actions; authoritative generated
  guidance and focused regression coverage.
- Non-goals: concurrent product mutation, Adhoc ownership of focused-workflow
  artifacts or anticipated contract work, automatic semantic approval of a
  changed contract, rebasing an established execution boundary, changing
  shelving/abandonment semantics, or adding a general scheduler or worktree
  manager.

## Expected behavior

`specdev adhoc start` may coexist with a focused standalone Assignment or
Mission only when its durable run is unambiguous, no product execution or Git
boundary has begun, no live or uncertain worker/reviewer/controller Attempt can
mutate it, and the product worktree has no ambiguous ownership. Contract
brainstorming, an approval decision point, and later genuinely quiescent
pre-execution positions are eligible; the implementation may model these as an
explicit allowlist rather than treating every non-terminal state as safe.

Starting the detour records the complete focused owner and protected path set
without changing focus, lifecycle position, contracts, approval state, child
state, run identity, or Attempts. While Adhoc is active, commands that could
approve, review, execute, replace, abandon, shelf, refocus, or otherwise advance
the focused workflow fail before mutation. Adhoc finish commits only its exact
owned paths and receipt; cancellation leaves source changes untouched. Neither
path terminates or replaces the focused workflow.

After finish or cancel, the focused workflow retains a durable revalidation
obligation describing the detour boundary and changed product paths. It cannot
cross its next approval, execution, or Git boundary until the current foreground
agent has rechecked affected contract assumptions against the post-detour
repository and completed an explicit, auditable revalidation action. Materially
changed scope or acceptance returns to normal contract editing and exact user
approval; an unchanged contract may continue under the same identity.

## Important decisions

- Generalize focused coexistence around an owner-neutral Assignment-or-Mission
  record instead of adding a parallel Mission-only transaction path.
- Treat safe lifecycle positions as a closed allowlist supported by ownership,
  Attempt-liveness, dirty-worktree, and execution-boundary checks; uncertainty
  fails closed.
- Revalidation is an explicit workflow gate, not a claim that path comparison
  can prove semantic contract validity. It must be recoverable from durable
  artifacts rather than private session memory.
- Adhoc remains a single exact Git transaction. It never absorbs focused state
  or work merely because the focused contract mentions the same files.

## Constraints and invariants

- Existing Adhoc exact-manifest, unchanged-HEAD, temporary-index,
  compare-and-swap, delivery-recovery, and cancellation guarantees remain
  intact.
- Assignment and Mission identities, graph positions, approvals, child queues,
  contracts, review artifacts, and Attempts remain outside Adhoc delivery.
- Existing Discussion and Test Audit coexistence remains compatible, and only
  one Adhoc may be active in a worktree.
- Human and JSON diagnostics identify the conflicting owner, boundary, Attempt,
  dirty path, or required revalidation action without prescribing implicit
  shelving or abandonment.

## Delegated and reserved authority

- Delegated: the internal focused-owner schema, safe-position allowlist,
  protected-path derivation, revalidation marker/action representation,
  actionable diagnostics, and focused fixtures consistent with the constraints
  above.
- Reserved for the user: contract approval and material reapproval, explicit
  shelving or abandonment, resolving ambiguous product ownership, authorizing
  verification, and any broader concurrent-execution or boundary-rebase design.

## Risks and assumptions

The primary risk is falsely classifying a Mission controller, nested child, or
Attempt as quiescent and allowing two mutating owners. A second risk is clearing
Adhoc state without leaving enough durable evidence to force semantic
revalidation. Both cases must default to blocking. The design assumes a
post-detour revalidation action can preserve exact prior approval when the
contract is unchanged while routing material contract changes through the
existing approval rules.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: At every explicitly supported Assignment and Mission contract-formation
  or quiescent pre-execution position, Adhoc start succeeds only when ownership,
  Attempts, execution boundaries, and product paths are safe, and it preserves
  the exact focused identity, run position, approval/child state, artifacts, and
  protected paths outside Adhoc ownership.
- AC-2: During coexistence, every focused approval, review, execution, focus,
  replacement, or terminal command is blocked before mutation; Adhoc finish and
  cancel retain their transactional guarantees, preserve the same focused
  workflow, and leave a durable changed-path/revision revalidation obligation
  that must be explicitly satisfied before its next approval, execution, or Git
  boundary.
- AC-3: Product execution or Git boundaries, live/uncertain Attempts, ambiguous
  focused ownership, dirty product work, and unsupported lifecycle positions
  block Adhoc before state creation with actionable human/JSON diagnostics;
  focused regression coverage and template/embedded/public guidance consistently
  enforce the same Assignment-and-Mission behavior without regressing existing
  standalone Assignment, Discussion, Test Audit, or exact-delivery guarantees.
