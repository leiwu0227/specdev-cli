# Roadmap Lane

Parent design: `workflow_lanes.md`

## Purpose

Roadmap is the lane for collaborating with the user on durable design direction and the anticipated sequence of future implementation work.

It preserves agreed intent without turning design collaboration into a delivery workflow. Roadmap answers what the system should become and which approved parts are not yet reflected in code; it does not implement those decisions.

## Authority

Roadmap may revise only the project’s roadmap designs and forecast with explicit user approval. Product code, workflow state, and every other project artifact remain read-only.

Design authority belongs to the user. The agent may inspect, compare, organize, and propose, but a proposal becomes part of the roadmap only after the user agrees to it.

Roadmap approval grants authority to record the design. It does not grant authority to change product code, launch another lane, or treat forecast items as approved implementation contracts.

## Design Notes

Roadmap design notes describe the intended architecture at a stable level of abstraction. They capture purpose, responsibilities, relationships, important choices, and invariants without duplicating current implementation details.

The design set is hierarchical. Parent notes define shared abstractions; lane and feature notes specialize them without repeating their full content. Each focused note owns one independent concept or module and refers to its parent design when context is needed.

Designs express the approved target state. They may intentionally lead current implementation, and current code may contain additional behavior that has not yet been incorporated into the designs.

## Forecast

The forecast identifies approved design requirements that are absent or incomplete in the codebase. It compares code against designs, not designs against code.

Forecast gaps are ordered by dependency so foundational work appears before features that depend on it. The forecast describes future work at a planning level; it is not an implementation plan, backlog history, or record of completed work.

Code-only features do not create forecast gaps because the codebase may be a superset of the designs. Incorporating such features into the target architecture requires a separate user-approved Roadmap decision.

## Workflow Shape

Roadmap is stateless collaboration. It creates no workflow identity, RippleGraph state, receipt, snapshot, or automatic commit. The durable result is the current approved roadmap content itself.

There is no active Roadmap lifecycle to pause or resume. Roadmap applies while the user is explicitly collaborating on these notes. Selecting another lane immediately supersedes that collaboration without a transition or exit operation.

## Relationship to Other Lanes

Roadmap may inspect the codebase read-only to understand implementation gaps. That inspection does not become Discussion state or implementation authority.

When the user decides to implement a forecast item, the work begins under a separately selected mutation-capable lane. The destination lane receives fresh authority appropriate to its scope and does not inherit approval merely because the design is agreed.

## Design Choices

- Roadmap records target design rather than implementation history.
- Design approval and implementation approval remain separate.
- Forecasting is one-way from approved designs to code gaps.
- Stateless collaboration is sufficient because the notes themselves are the durable result.
- Hierarchical notes favor stable abstractions over code-level replication.
