# Adhoc Lane

Parent design: `./workflow_lanes.md`

## Purpose

Adhoc delivers one explicitly selected, bounded repository change when a contract-driven Assignment and independent review cycle would add unnecessary ceremony.

It provides stronger ownership and delivery guarantees than Direct while remaining graph-free and lightweight. Adhoc is a deliberate mutation lane, not a fallback for every small request.

## Authority

The user grants Adhoc authority by selecting a concrete change scope. Within that scope, Adhoc may modify product and supporting repository artifacts needed for the bounded outcome.

Adhoc does not acquire authority over adjacent work merely because it is present in the worktree. State and artifacts owned by another lane remain outside its boundary. Scope expansion requires a new user decision rather than silent adoption.

Adhoc has no authority to change another workflow’s contract, lifecycle, focus, or evidence.

## Workflow Shape

Adhoc is a one-shot delivery transaction without a RippleGraph lifecycle or scheduler. Only one Adhoc transaction may be active in a worktree because its Git and ownership boundaries must remain unambiguous.

The lane records enough temporary state to preserve its starting revision, selected scope, existing-change ownership, and verification evidence. That state supports safe completion but does not turn Adhoc into a resumable multi-phase workflow.

Adhoc performs the change directly. It does not create a planning graph, worker hierarchy, or automatic review gate.

## Existing Work and Ownership

Adhoc begins from an explicit Git boundary. Existing product changes must be resolved separately or deliberately adopted as part of the whole eligible dirty set. Adoption is an ownership decision, not a convenience for staging selected files.

Ambiguous product ownership fails closed. Discussion and Test Audit artifacts remain protected under their own identities and cannot be absorbed into Adhoc delivery.

An active standalone Assignment may coexist only at a quiescent approved pre-implementation boundary. Its identity, artifacts, workflow state, and Attempts remain preserved. Adhoc cannot absorb Assignment work, and the Assignment cannot advance while the detour owns the repository mutation boundary.

Established Assignment implementation, live or uncertain Attempts, Mission-owned work, or ambiguous dirty product state blocks coexistence. The Assignment is never automatically shelved or terminated to make room for Adhoc.

## Completion and Cancellation

Successful completion produces one exact delivery commit and one concise durable receipt. Delivery includes only valid Adhoc-owned changes and derives path facts from Git rather than relying on narrative claims.

Verification evidence may be retained as part of the receipt, including failed attempts and later passing reruns. Verification authority still comes from the user and repository policy, not from selecting Adhoc.

Cancellation ends Adhoc ownership without discarding source changes. The user decides how any remaining changes should be handled afterward.

## Concurrency

Adhoc is not a scheduler. It may preserve independent read-only callable state and, under the narrow boundary above, temporarily coexist with a standalone Assignment. It must not use that coexistence to advance, mutate, or deliver another lane’s work.

## Design Choices

- Explicit scope replaces a full contract only for bounded work.
- Git ownership is established before mutation and verified at delivery.
- Dirty-work adoption is all-or-nothing for eligible existing changes.
- Other lane identities and artifacts remain outside Adhoc ownership.
- One delivery commit and receipt provide a durable boundary without a graph.
- Cancellation preserves user work rather than interpreting cancellation as deletion authority.
