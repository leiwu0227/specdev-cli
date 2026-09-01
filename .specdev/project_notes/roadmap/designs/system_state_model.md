# System State Model

Parent design: `core_concepts.md`

## Purpose

SpecDev keeps project intent, workflow recovery, operational execution, and product history understandable from the repository without requiring a hosted control plane or one agent session.

The system-state model separates information by ownership and durability. This prevents generated runtime, workflow checkpoints, caches, and human decisions from becoming interchangeable merely because they share the same installation.

## State Classes

An installed SpecDev environment contains four state classes.

### Managed Runtime

Managed runtime is shipped by SpecDev and supplies workflow instructions, templates, built-in skills, and versioned workflow definitions. It may be refreshed when the installed SpecDev version changes.

Local edits to managed runtime are overrides, not product-source changes or durable project authority.

### Project-Owned Durable State

Project-owned state records the project’s intent and history: context, designs, living knowledge, configuration, workflow artifacts, evidence, findings, outcomes, and receipts.

It is readable, diffable, and portable. Installation maintenance preserves it unless an explicit, user-authorized migration says otherwise.

### Engine-Owned Workflow State

Engine-owned state records recoverable workflow position, identities, transitions, and active orchestration. It is durable enough for recovery but is mutated only through supported semantic operations.

Direct editing is outside the architecture because it can bypass validation and make workflow meaning disagree with human artifacts.

### Operational State

Operational state supports execution through caches, indexes, provider output, process details, temporary worktrees, and session continuity.

It is local, replaceable, and often ignored by Git. Losing it may reduce convenience or require reconstruction, but it must not erase the sole record of authority, accepted evidence, or completed outcomes.

## Authority and History

Human-readable project artifacts are authoritative for approved intent and durable conclusions. Workflow state is authoritative for recoverable orchestration position. Git is authoritative for product revisions and delivery history.

Derived views may summarize these sources but never replace them. When sources disagree, the system exposes the inconsistency and recovers from the owning authority rather than choosing whichever representation is easiest to read.

## Product Source and Installation

SpecDev product behavior is authored in the product source and packaged runtime templates. The installed project state is a consumer of that product, not a second implementation location.

Initialization establishes the state classes for a new project. Update refreshes managed runtime while preserving project-owned state. A migration may transform project-owned state only when its scope is disclosed and the user explicitly authorizes it.

Destructive reinitialization is a separate authority boundary. It must be deliberate because it may remove durable and operational state that SpecDev cannot reconstruct, even when some tracked content remains recoverable through Git.

## Consistency and Recovery

State-changing operations preserve ownership boundaries and fail closed when active execution or ambiguous state makes safe mutation uncertain.

Durable authority is written before replaceable runtime is retired. Repeated maintenance or recovery operations should converge safely and avoid duplicating workflow identity, evidence, or project records.

The layout may evolve without changing the architecture as long as each state class retains its ownership, preservation, and authority semantics.

## Design Choices

- Repository-portable files hold durable project meaning.
- Managed runtime and project-owned state have different update policies.
- Workflow state is recoverable but not manually authored.
- Operational state improves execution without becoming authority.
- Git history, workflow position, and human decisions remain distinct sources.
- Destructive installation changes always require explicit authority.
