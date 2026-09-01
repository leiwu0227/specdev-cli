# Assignment Execution Modes

Status: implemented

## Decision

Standalone Assignment implementation supports three provider-neutral execution
modes: `auto`, `inline`, and `spawned`. Omission resolves to `auto`. For an
ordinary foreground standalone Assignment, `auto` resolves to inline execution;
the foreground coding agent may deliberately choose spawned execution before
product mutation when unattended work, process isolation, provider
specialization, a clean-context retry, or another bounded recorded reason makes
delegation useful. A fixed user policy or explicit user override outranks that
agent choice. Mission-controlled Assignment execution remains spawned.

During inline execution, the foreground coding agent fulfills the worker
responsibility under the exact approved contract. This does not grant lifecycle,
approval, scope-expansion, or reviewer authority. Spawned execution uses the
configured worker profile. The effective mode, decision source, bounded reason,
and current owner are frozen at the implementation Git boundary and recorded in
durable provider-neutral state. SpecDev does not silently switch executors after
product mutation or make private session continuity the only recovery path.

Both modes converge on the same plan and outcome schemas, acceptance evidence,
candidate identity, required independent review or approved waiver, divergence
handling, exact-path delivery, and final commit. Inline implementation and
review repairs return to the foreground coding agent; spawned-mode repair
preserves the frozen worker result and may use only its bounded continuation
path. A required reviewer remains separate from the implementation author in
either mode.

Before a standalone Assignment advances from `implementation` to
`implementation-review`, SpecDev runs the shared delivery and candidate
preflight used again by review, waiver, recovery, and finalization. An incomplete
candidate remains at `implementation`, returns bounded structured repair details
to the frozen implementation owner, and creates no reviewer Attempt, review
verdict, review round, or review artifact-repair consumption. Review and
finalization retain defensive candidate-identity revalidation.

`implementation/progress.json` remains the complete chronological verification
ledger. Candidate and final receipts derive a bounded current-obligation
projection keyed by exact `(role, command, revision)`: the latest valid receipt
is effective, earlier exact-key attempts remain superseded history, and
qualification evidence cannot satisfy an authoritative obligation. Preview size
alone never makes valid evidence incomplete, unresolved authoritative failures
or skips remain blocking, and candidate identity continues to bind the complete
progress artifact. Historical version 1 receipts remain readable. Existing
Mission orchestration and authority do not change, although shared Mission-child
receipt consumers may inherit this pure projection.

Making spawned execution mandatory for ordinary foreground Assignments,
allowing an agent heuristic to override a fixed user mode, switching executors
across an ambiguously owned dirty candidate, treating bounded receipt previews
as the evidence authority, using provider-private state as the only durable
execution decision, or allowing an inline author to satisfy its own required
review requires explicit user notification and approval as an architecture
change.

## Verification

Aligned at Git revision `3c03a08acbc4142b07f6d6b88894e5c3c5dd95da`.
Assignment `00068_make-assignment-implementation-execution-default` delivered
and independently reviewed the provider-neutral mode selection, frozen owner,
inline and spawned recovery, Mission fixity, and shared delivery gates in
`src/commands/implement.js`, `src/commands/reviewloop.js`,
`src/utils/assignment-vnext.js`, installed workflow guidance, and focused
fixtures. Assignment
`00071_reduce-implementation-stage-drag-by-coalescing-s` delivered and
independently reviewed the shared early candidate preflight, bounded effective
verification projection, historical receipt compatibility, owner-preserving
repair, and unchanged Mission orchestration in `src/commands/implement.js`,
`src/commands/reviewloop.js`, `src/utils/assignment-delivery.js`,
`src/utils/delivery-artifacts.js`, `tests/test-implement-recovery.js`, and
`tests/test-vnext-foundations.js`.
