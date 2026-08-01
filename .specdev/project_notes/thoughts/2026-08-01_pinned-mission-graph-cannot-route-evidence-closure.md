# Pinned Mission graph cannot route evidence closure

## Summary

A long-running Mission can finish its implementation and pass its exact final
verification command, yet still be forced into a terminal
`infrastructure-failure` because its pinned lifecycle graph cannot represent the
resolver's successful `evidence-closed` disposition.

This happened in `oceandata_tau` Mission `M00003`. The Mission was created with
`mission-lifecycle@1.3.0`. After all child Assignments were integrated, a final
gap was resolved through evidence and the arbiter concluded that the gap was
closed. The active graph's `replan` node only accepted `replanned` and
`objective-failure`, so the current compatibility code converted the successful
result into this terminal failure:

> Pinned Mission graph cannot route evidence closure for gap
> gap-aff652c320205591; ending with an explicit infrastructure failure.

The controller then marked the Mission failed. Running the approved final
command directly from the primary repository succeeded, and the clean delivery
was checkpointed, but SpecDev could no longer complete or land the Mission
through its normal lifecycle.

## Current behavior

`src/utils/mission.js` contains
`normalizeMissionGapResolutionForGraph(graph, resolved)`. When a resolver returns
`evidence-closed` and the active node schema does not allow that value, the
function rewrites the disposition to `infrastructure-failure`. The Mission
controller records that failure and calls its terminal failure path.

The current source template has already moved to
`mission-lifecycle@1.4.0`. Its `resolve-gap` node explicitly accepts and routes
`evidence-closed`, so newly created Missions using that package should not hit
this exact defect. However, an in-flight Mission remains bound to its older
package. A normal SpecDev update does not repair the already pinned run.

The compatibility behavior is covered deliberately in
`tests/test-vnext-foundations.js`, which means the infrastructure failure is not
an accidental exception. It is the defined fallback for version skew. The
problem is that this fallback turns a semantically successful, fully evidenced
delivery into an unrecoverable terminal failure after the expensive work has
already finished.

## Why this is an orchestration problem

Workflow pinning is valuable for reproducibility, but a pinned graph and the
controller that drives it still need a compatible semantic protocol. Here the
new controller can produce a valid gap-resolution result that the old graph
cannot express. The mismatch is discovered only at the transition boundary,
after implementation, review, and gap arbitration.

The resulting Mission state is misleading:

- Product implementation is complete.
- The exact final verification command passes.
- The gap is positively closed by evidence.
- The durable Mission status says `failed`.
- Normal `mission run` cannot advance the terminal run.
- Normal landing is unavailable even though the delivery is checkpointed.

This conflates an orchestration-protocol incompatibility with delivery failure
and gives the operator no supported recovery path.

## Recommended direction

### 1. Detect graph/controller incompatibility before execution

At `mission run` startup, validate every controller disposition that may be
emitted against the pinned graph node schemas. If the active package cannot
represent required modern semantics, stop before launching workers or offer a
supported migration. Do not discover the incompatibility after convergence.

### 2. Add a durable active-run migration

Provide a narrowly defined migration from `mission-lifecycle@1.3.0` to
`mission-lifecycle@1.4.0` for non-terminal Missions. The migration should:

- verify that the current node and recorded state have an unambiguous mapping;
- preserve the Mission contract, queue, gaps, Attempts, checkpoints, and
  approval authority;
- record the old and new graph package identities and the migration reason;
- be atomic and crash-resumable;
- resume at `resolve-gap` without launching another resolver or arbiter when a
  valid `evidence-closed` result is already durable.

This could be an explicit command such as `specdev mission migrate M00003`, or
an update option that requires operator confirmation. It should not silently
rewrite arbitrary pinned workflows.

### 3. Support recovery of the terminal compatibility failure

Existing Missions may already have been converted to
`infrastructure-failure`. Add a constrained recovery path that recognizes this
specific failure signature, confirms that the gap has durable positive closure
evidence, migrates the graph, and reconstructs the correct transition. Recovery
must not reinterpret genuine implementation, authority, or verification
failures as success.

For the `oceandata_tau` incident, recovery should retain the successful final
verification receipt and checkpoint, return the affected gap to
`evidence-closed`, and allow the Mission to reach its normal completed/landing
state without rerunning provider work.

### 4. Keep failure semantics precise

If safe migration or recovery is impossible, report a distinct status such as
`workflow-incompatible` or `migration-required`. Avoid persisting it as the
Mission's delivery disposition. An orchestration compatibility problem should
remain visibly separate from an objective failure.

## Acceptance scenarios

The eventual fix should cover at least these cases:

1. A fixture Mission pinned to `mission-lifecycle@1.3.0` reaches a gap whose
   existing arbiter result is `evidence-closed`; migration resumes and completes
   without another provider call.
2. Migration preserves contract hashes, approval, child delivery commits,
   checkpoint identity, gap evidence, and final-verification receipts.
3. Interrupting migration at each write boundary can be resumed safely without
   duplicate transitions or lost state.
4. `mission run` preflight catches an incompatible graph before launching a
   worker when no supported migration exists.
5. A genuine `semantic-failure`, `authority-failure`, or failed verification
   remains terminal and cannot use the compatibility recovery path.
6. A previously terminal compatibility failure can be recovered only when its
   exact failure signature and positive closure evidence agree.
7. New Missions on `mission-lifecycle@1.4.0` continue to route
   `evidence-closed` directly.
8. Unknown graph versions fail safely with an actionable message and do not
   mutate the run.

## Design principle

Pinning should make execution reproducible, not make completed work impossible
to acknowledge. Whenever controller semantics evolve beyond a pinned graph,
SpecDev needs either a compatible adapter, a safe durable migration, or an early
actionable refusal. A late conversion from evidence-backed success to terminal
failure should not be the steady-state compatibility policy.
