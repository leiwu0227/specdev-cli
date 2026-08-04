# Assignment contract

Kind: feature

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Deliver the structured Attempt-progress portion of the approved Mission contract at
`.specdev/missions/M00002_make-live-specdev-workflows-visibly-progressive-/brainstorm/contract.md`
(SHA-256 `f807741f24148b58f7bba60216c0686c95ce99afd2fa7cd40d13d2670f0cfbd2`),
so long-running worker and reviewer Attempts visibly demonstrate bounded activity.
This first-wave child has no prerequisite child outcome.

## Scope and non-goals

- In scope: provider-neutral collection, validation, freshness classification, and
  human/structured projection of live Attempt progress from controller telemetry
  and optional explicit milestones.
- Non-goals: the Mission's delivery-receipt and active-first status children; all
  other non-goals are inherited from the approved Mission contract.

## Expected behavior

While a worker or reviewer Attempt runs, command output exposes its identity,
role or phase, elapsed time, process/log liveness, last valid milestone when
available, and a fresh/quiet/stale classification. Controller-known telemetry
remains useful when no milestone is supplied, while invalid milestone input
degrades to a bounded diagnostic without changing the Attempt disposition.

## Important decisions

Progress remains ignored runtime telemetry, and human-readable and structured
output are projections of one validated result. Exact schemas, thresholds, and
presentation are delegated within the approved Mission boundaries.

## Constraints and invariants

Inherit the approved Mission's constraints and invariants unchanged. In
particular, progress must be bounded, provider-neutral, safe for non-interactive
terminals, free of raw reasoning or secrets, and unable to alter lifecycle
authority when absent, malformed, oversized, quiet, or stale.

## Delegated and reserved authority

- Delegated: exact progress schema, runtime representation, freshness thresholds,
  formatting, and focused fixtures needed for this child.
- Reserved for the user: all authority reserved by the approved Mission,
  including workflow-authority changes, reasoning exposure, retention changes,
  destructive cleanup, and verification outside its authorization.

## Risks and assumptions

Providers may emit no usable milestones, and process or log activity can be
temporarily quiet; controller-only fallback must therefore remain informative,
and stale must remain a diagnostic classification rather than inferred failure.

## Verification authority

Focused verification may cover Attempt progress validation, fallback telemetry,
freshness classification, and human/structured projections after the repository's
required user confirmation. The Mission's final integrated command and all other
verification authority remain inherited and reserved to the approved Mission.

## Acceptance criteria

- AC-1: During a long-running worker or reviewer Attempt, human and structured
  command output expose bounded progress containing Attempt identity, role or
  phase, elapsed time, process/log liveness, the last valid milestone when
  available, and a fresh/quiet/stale classification.
- AC-2: With absent, malformed, stale, or oversized milestones, progress falls
  back to bounded controller telemetry or a safe diagnostic without leaking raw
  reasoning, crashing the controller, or changing the Attempt's lifecycle
  disposition.
