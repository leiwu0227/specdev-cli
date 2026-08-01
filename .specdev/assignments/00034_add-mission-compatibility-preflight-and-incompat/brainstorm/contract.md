# Assignment contract

Kind: feature

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Implement the first child boundary of
`.specdev/missions/M00001_make-pinned-mission-graph-and-controller-version/brainstorm/contract.md`,
approved at `8f5844db8a82036c50e512ecdef69957bb6e53d1c2a93e1c17d0c87f1db04184`:
detect pinned Mission graph/controller incompatibility before provider work and
surface stable compatibility outcomes for the later migration and recovery
children. This wave has no child prerequisite.

## Scope and non-goals

- In scope: compatibility evaluation for every controller disposition reachable
  from the current Mission phase, pre-provider and transition-boundary guards,
  `migration-required` and `workflow-incompatible` status semantics, actionable
  human/JSON output, and the compatible `mission-lifecycle@1.4.0` direct path.
- Non-goals: active-run migration, migration journaling, terminal recovery, or
  any other work delegated to children 00035 and 00036; all unchanged Mission
  non-goals are inherited.

## Expected behavior

Known supported schema mismatches return `migration-required` with the exact
explicit next command, unknown mismatches return `workflow-incompatible` with
actionable diagnostics, and compatible pins proceed normally. The same
classification is enforced before any provider launch and at the transition
boundary without changing the Mission delivery disposition or disguising the
result as an infrastructure failure; all other Mission behavior is inherited.

## Important decisions

Compatibility is a read-only, first-class workflow outcome distinct from
delivery failure. One reusable evaluator supplies both guards and status output
so later migration and recovery children can consume the same classification
without redefining it.

## Constraints and invariants

No worker, reviewer, resolver, or arbiter process may start after an
incompatible result, and incompatibility checks must not mutate durable Mission
delivery state. All unchanged Mission constraints and invariants are inherited.

## Delegated and reserved authority

- Delegated here: compatibility-matrix representation, reachable-disposition
  calculation, schema comparison, result/JSON shape, actionable wording, guard
  integration, and focused fixtures within the approved Mission authority.
- Reserved: all authority reserved by the Mission remains reserved; run
  migration and terminal recovery mutations remain delegated to later children.

## Risks and assumptions

Pinned graph packages may not expose sufficient schema introspection, requiring
a narrow versioned compatibility adapter. Reachability must be conservative so
an omitted controller disposition cannot launch a provider; the stable outcomes
from this child are prerequisite inputs for children 00035 and 00036.

## Verification authority

Focused verification may cover known/unknown classification, the provider-spawn
barrier, the transition-boundary guard, human/JSON status output, and the
compatible `1.4.0` path, but test execution still requires the user approval
mandated by repository instructions. Full-suite and integrated Mission
verification authority are unchanged.

## Acceptance criteria

- AC-1: A known supported mismatch and an unknown mismatch are observably
  reported as `migration-required` and `workflow-incompatible`, respectively,
  with an exact actionable next step in human and JSON output, before any
  provider launch and without a delivery-failure mutation.
- AC-2: A compatible `mission-lifecycle@1.4.0` Mission proceeds normally, while
  a mismatch first encountered at a transition boundary returns the same
  compatibility outcome without launching another provider or being rewritten
  as `infrastructure-failure`.
