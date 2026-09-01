# Installed SpecDev Layout

Parent design: `./specdev_state_model.md`

## Purpose

The installed layout maps SpecDev’s state classes to stable locations inside a repository. It makes ownership, preservation, and recovery expectations understandable without treating every generated file or optional subdirectory as architecture.

The layout is a spatial contract for state ownership, not a complete directory inventory.

## Layout Template

An installed `.specdev/` environment contains four kinds of roots:

| Ownership class | Typical contents | Preservation model |
| --- | --- | --- |
| **Managed runtime** | Workflow entry guidance, built-in guides and templates, core skills, and versioned workflow definitions | Refreshed from the installed SpecDev product |
| **Project-owned state** | Project notes, living knowledge, configuration, custom guidance, workflow artifacts, evidence, outcomes, and receipts | Preserved unless an explicit migration is approved |
| **Engine-owned state** | RippleGraph identities, checkpoints, transitions, and active orchestration | Mutated only through supported semantic operations |
| **Operational state** | Caches, indexes, provider details, temporary worktrees, and session continuity | Replaceable and normally excluded from durable project history |

For example, refreshing a managed guide is installation maintenance. Rewriting a project design note is a project decision. Advancing a workflow checkpoint is an engine operation. Removing a cache is operational cleanup. Sharing one repository does not make these actions interchangeable.

## Stable Root Boundaries

Managed runtime and project-owned state remain separate even when both are tracked by Git. Update may replace managed runtime but must preserve user-authored project records.

Engine-owned state is durable enough for recovery but is not manually authored. Human-readable workflow artifacts explain approved intent and accepted outcomes; engine state records where governed execution currently stands.

Operational state may be recreated from durable sources. No ignored cache, temporary worktree, provider transcript, or private session may become the sole record of authority, evidence, or completion.

Some project-owned roots appear only when first needed. Their absence does not change their ownership class, and creating them does not redefine the architecture.

## Installation and Evolution

Initialization establishes the layout and may create empty roots or starter records. Update refreshes managed runtime and may backfill missing scaffold files while preserving project-owned content. Migration is the explicit mechanism for changing project-owned structure or meaning.

Adding or regrouping files inside a correctly owned root is ordinary evolution. A material design change occurs when the system:

- renames or removes a stable ownership boundary;
- changes a root between managed, project-owned, engine-owned, or operational state;
- allows update to overwrite project-authored records;
- moves durable authority exclusively into ignored or engine-private state;
- treats direct file editing as equivalent to a supported workflow transition; or
- automatically seeds records that are supposed to represent user-approved project decisions.

New roots must declare their ownership and preservation behavior rather than inheriting authority from physical proximity.

## Design Choices

- The layout expresses ownership classes, not an exhaustive file tree.
- Managed refresh and project preservation are separate policies.
- Engine state is recoverable but changed only semantically.
- Operational state is replaceable and never authoritative by itself.
- On-demand directories retain predetermined ownership.
- Root reclassification is a material architecture decision.
