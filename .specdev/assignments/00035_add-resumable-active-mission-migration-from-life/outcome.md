# Outcome

## Delivered behavior

- Added an explicit `specdev mission migrate <id>` candidate for exact, in-place `mission-lifecycle@1.3.0` to `@1.4.0` active-run migration with conservative Mission, queue, gap, package, stack, position, and pending-transition validation.
- Added an atomic durable migration journal, digest-guarded resume at every state-write boundary, pure idempotent completion reads, and an incomplete-journal barrier on ordinary Mission execution.
- Added version-specific node/output mapping that preserves existing run evidence and carries a complete durable `evidence-closed` pending transition to `resolve-gap` without creating a provider Attempt.
- Added focused fixtures for root and nested positions, named evidence preservation, every interruption boundary with a real Mission-record mutation, evidence reuse, idempotency, unsupported versions, ambiguity, and failure non-mutation.

## Deviations

The blocking implementation review found that the original interruption loop used a node-preserving fixture, so the Mission write boundaries were no-ops and AC-2 evidence was overstated. The repair accepts an already-mapped pending transition only when its Mission digest exactly matches the prepared journal target, and the focused loop now uses the durable `evidence-closed` `replan`-to-`resolve-gap` mutation at all six boundaries.

## Unresolved risks

None.

| Acceptance | Evidence                                                                                                                                                                          | Result |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1       | `npm run test:mission-compatibility` passed the active 1.3-to-1.4 migration and preservation fixtures.                                                                            | Passed |
| AC-2       | `npm run test:mission-compatibility` passed all six declared write-boundary resumes using a real `replan`-to-`resolve-gap` Mission mutation, plus evidence reuse and idempotency. | Passed |
| AC-3       | `npm run test:mission-compatibility` passed unsupported-version, ambiguity, and failure non-mutation fixtures.                                                                    | Passed |
