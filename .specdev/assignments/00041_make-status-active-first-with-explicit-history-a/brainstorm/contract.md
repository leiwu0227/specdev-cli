# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make `specdev status` active-first with explicit history access under the Mission
contract at `.specdev/missions/M00002_make-live-specdev-workflows-visibly-progressive-/brainstorm/contract.md`, approved as
`f807741f24148b58f7bba60216c0686c95ce99afd2fa7cd40d13d2670f0cfbd2`.
Assignment 00039's completed outcome supplies the bounded Attempt-progress
projection this child may surface for active work.

## Scope and non-goals

- In scope: concise default human and JSON status projections centered on current
  work and next action, plus explicit access to the existing historical view.
- Non-goals: inherit all Mission non-goals unchanged; this child does not change
  progress production, terminal delivery receipts, or identity-specific status
  semantics.

## Expected behavior

Default status shows only applicable current focus, lifecycle or phase, active
Attempt or pending decision, next semantic command, dirty-path summary, and
blocker; complete run history appears only when explicitly requested. All other
Mission behavior is inherited unchanged.

## Important decisions

Use `--history` as the compatibility path for both human and JSON history, and
project default and historical output from the same validated status result
rather than independently deriving workflow state.

## Constraints and invariants

Inherit the Mission constraints and invariants unchanged, including deterministic
active, blocked, interrupted, and idle views and history access without reading
raw runtime files.

## Delegated and reserved authority

- Delegated: status result shaping, concise human formatting, and focused
  compatibility fixtures within this child boundary.
- Reserved for the user: all authority reserved by the Mission contract,
  including workflow authority and retention-policy changes.

## Risks and assumptions

JSON status has automation consumers, so default history removal must be paired
with an explicit, equivalent compatibility view. The completed 00039 outcome is
assumed authoritative for Attempt-progress validation and is not reopened here.

## Verification authority

- Focused status tests for default and `--history` human and JSON views are
  allowed after repository instructions are satisfied.
- Final integrated verification and all broader test commands remain governed by
  the Mission contract and its reserved authority.

## Acceptance criteria

- AC-1: Default `specdev status` human and JSON output omit complete run history
  and contain only the applicable current focus, lifecycle or phase, active
  Attempt or pending decision, next semantic command, dirty-path summary, and
  blocker.
- AC-2: `specdev status --history` preserves equivalent existing historical
  content for human and JSON consumers, while active, blocked, interrupted, and
  idle results remain deterministic and explicit Assignment and Mission status
  commands retain their existing semantics.
