# Assignment Selective Context Catalog

Parent design: `./assignment_lane.md`

## Purpose

Selective context loading reduces repeated orientation by giving each Assignment role the smallest useful view of durable project context.

The catalog describes available context sources and their purpose. It does not replace those sources, become workflow authority, or make hidden agent memory part of the Assignment.

## Context Template

Assignment context is organized into four conceptual groups:

- **Authority context:** the approved contract and delegated decisions that bound the work.
- **Task context:** the current plan, candidate, evidence, findings, and workflow state relevant to the active phase.
- **Supporting context:** project guidance, living knowledge, and design notes relevant to the objective.
- **Role history:** prior results that legitimately belong to the same bounded role lineage.

Authority and task context are loaded whenever their facts govern the current action. Supporting context is selected according to the objective and known uncertainties. Role history is included only when role independence and continuity rules permit it.

For example, an implementation owner may need relevant project guidance and earlier repair findings. An independent first reviewer instead receives the contract, exact candidate, and evidence without inheriting the author’s private reasoning.

## Selection and Expansion

The foreground agent or workflow host selects an initial context set from the catalog using the Assignment objective, phase, and role.

Selection is intentionally conservative but not permanently closed. An unfamiliar convention, unexpected behavior, material repository change, or unresolved contradiction requires loading the relevant durable source before continuing.

Selective loading must never turn absence of context into permission. When required authority or evidence cannot be located, the action stops or returns to a decision boundary rather than proceeding from assumption.

## Authority and Freshness

Catalog entries identify durable sources; they do not summarize away binding content. Approval, evidence, design decisions, and workflow state remain authoritative only in their owning artifacts.

A changed or stale source invalidates any derived context projection that depends on it. Recovery rereads the durable source instead of trusting an earlier packet or private transcript.

Mission-owned Assignments receive only parent context relevant to their delegated child objective. Context selection cannot expand child authority.

## Design Choices

- Context is selected by objective, phase, and role.
- Durable sources outrank catalogs, packets, summaries, and transcripts.
- Required authority and evidence are never optional context.
- Context expands when uncertainty or material change demands it.
- Reviewer independence limits inherited author context.
- Catalog loss degrades to direct reading of durable sources.
- Selective loading optimizes orientation without weakening recovery.
