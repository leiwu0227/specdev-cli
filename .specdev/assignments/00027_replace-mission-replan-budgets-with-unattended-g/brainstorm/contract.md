# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make an approved Mission run unattended to completion or an honest terminal
outcome. Replace reason-wide replan counters—which let one child consume another
child's recovery—with durable Mission gaps that track what remains unresolved
and converge independently.

## Scope and non-goals

- In scope: stable gaps for child follow-up, parallel-wave follow-up, Mission
  review, and final verification; idempotent restart; automatic
  resolution/resolver/arbiter escalation; semantic, authority, and
  infrastructure failure classification; Mission graph revision and active
  legacy-run compatibility.
- Non-goals: recovering already-terminal Missions such as M00001, a generic
  retry framework, user-configurable numeric budgets, changing Mission
  authority after approval, or coupling Assignment behavior to Mission state.

## Expected behavior

After Mission approval, no normal transition asks for user direction. A recovery
signal opens or reuses one stable gap. A focused resolution Assignment addresses
that gap; if the same gap remains, the controller automatically escalates
through resolver and arbiter rather than allocating a fresh unrelated budget.
Different children and waves converge independently. Restarting the controller
reuses durable state and cannot process the same signal twice.

## Important decisions

- Follow-up is unfinished Mission work, not a retry attempt. Remove
  reason-global `child_follow_up` and `parallel_wave_follow_up` allowances.
- The Mission controller translates ordinary child outcomes into gap state and
  remembers which later Assignment resolves each gap; child Assignments remain
  Mission-agnostic.
- Repair-generated children stay attached to their parent gap. Repeated
  follow-up advances that gap's finite ladder instead of creating an unbounded
  lineage.
- Semantic stages and dispositions belong to versioned Mission graph 1.4.0.
  Provider and controller recovery remain operational CLI behavior and do not
  consume semantic progress.

## Constraints and invariants

- Completed, integrated, and running queue entries remain immutable during gap
  resolution; existing pending IDs and the exact final verification command are
  preserved.
- Resolution may not expand approved scope, behavior, constraints, reserved
  authority, or verification authority.
- Only acceptance/verification evidence or final arbitration may classify an
  objective failure. Exhausted operational recovery must be reported separately
  as infrastructure failure.
- Active non-terminal legacy Missions remain resumable without mutating their
  pinned graph packages or manually editing `mission.yaml`.
- Recovery detail is created only when needed and compacted into the Mission
  outcome on success.

## Delegated and reserved authority

- Delegated: automatic gap creation and deduplication, focused resolution
  Assignments, resolver and arbiter execution, evidence-safe nonblocking closure,
  and infrastructure retry/restart within the approved Mission.
- Reserved for the user: contract expansion, changes to protected verification
  authority, explicit pause/cancellation, and starting a successor for an
  already-terminal Mission.

## Risks and assumptions

- Stable source identity and lineage must prevent wording changes from creating
  duplicate gaps.
- Infrastructure failure cannot be made successful by semantic replanning; it
  must preserve work and remain distinguishable from product failure.
- A genuinely impossible or out-of-authority gap must terminate honestly after
  arbitration rather than loop or claim completion.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Focused Mission command/restart fixtures: allowed after repository instructions are satisfied
- Full suite and lint: require explicit user approval

## Acceptance criteria

- AC-1: Child and wave recovery use durable, stable gap identities with
  idempotent restart and independent convergence; two different children may
  each request follow-up without sharing a budget, while repair descendants map
  back to the same parent gap.
- AC-2: Every post-approval semantic path is unattended and finite: resolution,
  resolver, and arbiter run automatically; no round or recovery exhaustion asks
  for user direction; Assignment remains Mission-agnostic; only evidence-safe
  closure or objective/authority failure ends a gap.
- AC-3: Semantic, authority, and infrastructure failures remain distinct,
  active legacy Missions resume compatibly, Mission graph 1.4.0 owns the new
  dispositions without mutating older packages, and focused tests cover
  independence, deduplication, escalation, restart, failure classification, and
  graph routing.
