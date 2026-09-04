# Assignment Selective Context Catalog

Parent design: `./assignment_lane.md`

Selective context gives each Assignment role the smallest useful durable view of the
project while ensuring that binding authority and evidence are never omitted.

The catalog groups context as authority, task, supporting, and optional material.
Authority includes the exact contract, approval, execution decision, workflow state,
and current evidence required for the role. Task context includes implementation
artifacts and relevant current code. Supporting context includes matched Roadmap
designs, living knowledge, guides, and promotion provenance. Optional context can be
loaded when a specific uncertainty arises.

Selection begins from objective terms and deterministic required paths. Roadmap and
knowledge matches are ranked and bounded. The catalog stores descriptors, purposes,
freshness facts, and hashes rather than summarizing away the authoritative content.
The agent opens the owning document when it must rely on a decision or constraint.

Workers receive implementation-relevant context within delegated scope. Reviewers
receive the candidate, contract, evidence, and review policy without inheriting
private author reasoning. Mission children receive only parent context relevant to
their child objective. Recovery expands context when state changed or uncertainty
cannot be resolved from the initial packet.

A changed or stale source invalidates dependent projections. Missing catalogs degrade
to direct reading of durable sources; they never block recovery or become the sole
record of authority.

## Source Targets

- `src/utils/assignment-context.js` — maximum 680 lines — catalog construction, matching, and role selection.
- `src/utils/guides.js` — maximum 110 lines — guide catalog loading.
- `src/utils/knowledge.js` — maximum 1000 lines — ranked durable knowledge retrieval.
- `src/commands/context.js` — maximum 120 lines — bounded project overview.
