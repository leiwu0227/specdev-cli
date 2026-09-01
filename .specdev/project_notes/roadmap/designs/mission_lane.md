# Mission Lane

Parent design: `workflow_lanes.md`

## Purpose

Mission coordinates a user-approved objective whose delivery benefits from Assignment decomposition, integrated evidence, or controlled concurrency.

It is a foreground controller, not a synonym for large work and not an autonomous backlog planner. A Mission may contain one full-scope Assignment when no meaningful decomposition is justified.

## Authority

Mission receives authority from the user’s approval of the exact parent contract. The contract defines the integrated objective, shared constraints, reserved decisions, acceptance criteria, and final verification boundary.

The Mission delegates subsets of that authority to child Assignments. Child contracts inherit unchanged parent decisions and add only the bounded detail needed for their own work. No child may expand the parent objective or convert an unresolved product decision into implementation discretion.

Material divergence returns to the user through a visible reapproval boundary. Successful child work does not silently broaden later children’s authority.

## Workflow Shape

Mission is a focused RippleGraph workflow that owns the repository’s primary scheduler for its lifetime. A foreground controller maintains the parent lifecycle, child queue, integration order, convergence state, and final outcome.

Child Assignments retain normal Assignment authority, evidence, and review boundaries, but their delivery belongs to the Mission controller. The controller integrates reviewed child results rather than allowing children to independently land the parent objective.

Durable Mission and child artifacts make the controller recoverable. An interrupted controller may be resumed or explicitly taken over after ownership is inspected; private session continuity is never required.

## Child Design

Mission begins with one full-scope child unless the approved objective contains a real execution, dependency, decision, verification, or rollback boundary.

When multiple children are justified, their contracts form a static, understandable decomposition of the parent. File count, task count, or a desire for parallel speed does not by itself justify splitting authority.

Unresolved review findings, failed evidence, or required follow-up become explicit durable gaps. Resolution work remains linked to the gap and constrained by the parent contract rather than becoming an unbounded retry chain.

## Concurrency and Integration

Children run sequentially by default. Mutually independent children may form a bounded parallel wave when their product ownership, dependencies, and verification do not interfere.

Parallel children execute in isolated worktrees and are integrated in a declared order. The controller, not individual workers, owns concurrency and integration. Parallelism must not change authority, review requirements, or the meaning of the final candidate.

Dependent children wait for the integrated results they require. Integration conflicts or ambiguous ownership fail closed rather than being resolved through silent precedence.

## Evidence and Convergence

Each child supplies evidence and review appropriate to its delegated contract. The Mission evaluates those results against the parent objective and preserves unresolved gaps until they are genuinely closed or returned to the user.

Completion requires an integrated candidate that satisfies the parent acceptance criteria and its exact final verification boundary. Child success alone is insufficient when the combined result has not converged.

A deterministic full-scope child may satisfy much of parent convergence when its reviewed candidate still represents the complete approved objective. The Mission nevertheless retains parent-level integration and completion authority.

## Completion and Abandonment

Successful completion produces a durable Mission outcome and an integrated Git identity ready for explicit landing. Landing is a repository-history decision, not an automatic consequence of child completion.

A Mission may be explicitly abandoned when continuation is no longer desired. Abandonment preserves inspectable work and terminal facts; it does not silently delete branches, land partial changes, or reinterpret incomplete work as success.

## Design Choices

- Parent authority is delegated, never recreated independently by children.
- One full-scope child is the default; decomposition requires a semantic reason.
- The foreground controller owns scheduling, integration, and convergence.
- Parallelism is bounded by independence and ownership isolation.
- Integrated evidence, not child count, determines completion.
