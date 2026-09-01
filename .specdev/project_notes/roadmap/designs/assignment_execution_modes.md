# Assignment Execution Modes

Parent design: `assignment_lane.md`

## Purpose

Assignment execution may remain with the foreground coding agent or be delegated to a spawned worker. Execution modes make that ownership choice explicit without changing the approved contract or the Assignment’s governance.

The design preserves useful session context for ordinary interactive work while retaining delegated execution for isolation, specialization, unattended work, and Mission control.

## Modes

**Inline execution** assigns the implementation-owner role to the foreground coding agent. The agent plans, modifies the product, records evidence, and repairs findings within the current collaborative session.

**Spawned execution** delegates the implementation-owner role to a bounded worker Attempt using the selected provider profile. The foreground agent retains workflow coordination while the worker performs the approved implementation responsibility.

**Automatic selection** applies a deterministic default while allowing an explicitly fixed policy to choose the mode. Ordinary standalone Assignment work defaults to inline execution. Mission-controlled child execution remains delegated to the Mission’s worker boundary.

## Authority

Execution mode changes who fulfills the worker role, not what that role may decide.

Inline execution does not grant the foreground agent lifecycle, approval, scope-expansion, or reviewer authority. Spawned execution does not allow a worker to reinterpret the contract or act as the required reviewer.

User-selected or project-fixed execution policy outranks agent preference. An agent may choose a non-default mode only within delegated policy and for a bounded reason such as isolation, provider capability, specialization, or recovery.

## Decision Boundary

The effective mode, decision source, implementation owner, and any non-default reason are fixed before product mutation begins. This establishes one unambiguous owner for the candidate.

SpecDev does not silently switch executors after work has crossed the implementation Git boundary. A changed executor requires an explicit recovery path that first resolves existing ownership and dirty state.

The frozen decision is durable enough to resume after interruption without depending on private conversation memory.

## Convergence

Inline and spawned execution converge on the same plan, acceptance evidence, candidate identity, review policy, divergence handling, and exact delivery boundary.

Repairs return to the frozen implementation owner. Inline repairs return to the foreground agent; spawned repairs preserve the delegated worker boundary or use an explicit replacement path when recovery requires it.

A required reviewer remains independent from the implementation owner in either mode. Faster or more convenient execution cannot weaken review or evidence requirements.

## Recovery

Loss of an inline session does not invalidate the Assignment because the contract, execution decision, artifacts, and workflow position are durable. A new foreground session may continue the same inline responsibility.

A failed spawned Attempt does not silently transfer ownership to the foreground agent. Replacement or fallback occurs only through a supported recovery decision that preserves the candidate boundary.

## Design Choices

- Executor selection is provider-neutral and separate from product authority.
- Interactive standalone work favors context-preserving inline execution.
- Mission child execution preserves controller-owned delegation.
- Execution ownership freezes before product mutation.
- All modes share identical evidence, review, and delivery semantics.
- Recovery resolves ownership explicitly rather than switching executors around dirty work.
