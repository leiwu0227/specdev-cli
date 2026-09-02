# Adhoc Lane

Parent design: `./workflow_lanes.md`

## Purpose

Adhoc delivers one explicitly selected, bounded repository change when a contract-driven Assignment and independent review cycle would add unnecessary ceremony.

It provides stronger ownership and delivery guarantees than Direct while remaining graph-free and lightweight. Adhoc is a deliberate mutation lane, not a fallback for every small request.

## Authority

The user grants Adhoc authority by selecting a concrete change scope. Within that scope, Adhoc may modify product and supporting repository artifacts needed for the bounded outcome.

Adhoc does not acquire authority over adjacent work merely because it is present in the worktree. State and artifacts owned by another lane remain outside its boundary. Scope expansion requires a new user decision rather than silent adoption.

Adhoc has no authority to change another workflow's contract, lifecycle, focus, or evidence.

## Workflow Shape

Adhoc is a one-shot delivery transaction without a RippleGraph lifecycle or scheduler. Only one Adhoc transaction may be active in a worktree because its Git and ownership boundaries must remain unambiguous.

The lane records enough temporary state to preserve its starting revision, selected scope, existing-change ownership, and verification evidence. That state supports safe completion but does not turn Adhoc into a resumable multi-phase workflow.

Adhoc performs the change directly. It does not create a planning graph, worker hierarchy, or automatic review gate.

## Existing Work and Ownership

Adhoc begins from an explicit Git boundary. Existing product changes must be resolved separately or deliberately adopted as part of the whole eligible dirty set. Adoption is an ownership decision, not a convenience for staging selected files.

Ambiguous product ownership fails closed. Discussion and Test Audit artifacts remain protected under their own identities and cannot be absorbed into Adhoc delivery.

An active Assignment or Mission may coexist with Adhoc while its contract is being formed or considered for approval, and during any later quiescent pre-execution boundary. No shelving, termination, or focus replacement is required. The focused workflow keeps its identity, contract artifacts, state, and Attempts; Adhoc owns only its separately approved mutation scope.

During the detour, the focused workflow must not cross an approval, execution, or Git boundary. After Adhoc completes or is cancelled, the focused workflow revalidates any contract assumptions affected by the changed repository before it advances. Its eventual approval or execution boundary is established against the post-detour product state.

Coexistence ends once Assignment implementation, Mission child execution, or other focused product mutation has begun. Live or uncertain Attempts and ambiguous dirty product state also block Adhoc. Adhoc never absorbs work anticipated by a focused contract merely because that contract is still being discussed.

## Completion and Cancellation

Successful completion produces one exact delivery commit and one concise durable receipt. Delivery includes only valid Adhoc-owned changes and derives path facts from Git rather than relying on narrative claims.

Verification evidence may be retained as part of the receipt, including failed attempts and later passing reruns. Verification authority still comes from the user and repository policy, not from selecting Adhoc.

Cancellation ends Adhoc ownership without discarding source changes. The user decides how any remaining changes should be handled afterward.

## Concurrency

Adhoc is not a scheduler. It may coexist with independent read-only callables and with a focused Assignment or Mission only within the pre-execution boundary above. The focused workflow remains durable but cannot advance while Adhoc owns repository mutation. Neither lane may mutate, adopt, or deliver the other's owned work.

## Design Choices

- Explicit scope replaces a full contract only for bounded work.
- Git ownership is established before mutation and verified at delivery.
- Dirty-work adoption is all-or-nothing for eligible existing changes.
- Contract brainstorming does not require shelving focused work for an independent Adhoc change.
- Other lane identities and artifacts remain outside Adhoc ownership.
- One delivery commit and receipt provide a durable boundary without a graph.
- Cancellation preserves user work rather than interpreting cancellation as deletion authority.
