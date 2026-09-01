# Workflow Model

Parent design: `core_concepts.md`

## Purpose

SpecDev represents governed work as an explicit relationship between human intent, delegated authority, execution, evidence, and durable outcomes.

A workflow defines how authorized work may progress. It does not decide product direction, replace human approval, or treat agent activity as authority merely because work was performed.

Workflow lanes specialize this model according to the risk, scope, state, and coordination needs of different kinds of work.

## Core Model

A workflow begins with an objective and an authority boundary. The boundary identifies what may be decided, what may be changed, and which decisions remain reserved for the user.

Work progresses through meaningful states. A transition represents an accepted change in workflow meaning, not merely the completion of a command or agent invocation. Every transition must satisfy the authority and evidence requirements of the current state.

Execution may require one or more Attempts by coding agents or deterministic tools. Attempts perform work but do not own workflow identity, approval, or lifecycle state. Failed or interrupted Attempts may be replaced without replacing the approved objective.

## Authority and Artifacts

Human-readable artifacts carry durable intent, decisions, evidence, findings, and outcomes. Approval-gated work binds the exact artifact being approved so later mutation cannot silently inherit earlier authority.

Workflow state records where governed work currently stands. Git records product revisions and delivery history. Operational state may help execution and recovery, but it must not become the sole record of authority or accepted evidence.

These responsibilities remain separate even when one command coordinates several of them.

## Stateful and Graph-Free Work

Not every lane requires a durable state machine.

Small or stateless lanes may apply the workflow model through a bounded interaction or delivery transaction without maintaining lifecycle state. Work that requires recoverable decisions, multiple authority boundaries, isolated concurrency, or coordinated execution uses an explicit stateful workflow.

## RippleGraph Backbone

RippleGraph is SpecDev’s workflow orchestration backbone for stateful workflows and isolated callables. Versioned graph definitions describe allowed lifecycle shapes, while distinct workflow instances preserve recoverable state.

SpecDev supplies the semantic lane operations and uses RippleGraph to validate transitions. Engine state is advanced only through those supported operations so validation and recovery cannot be bypassed.

RippleGraph owns orchestration, not product intent, lane authority, evidence judgment, or revision history. User-approved artifacts remain authoritative for intent, SpecDev defines the surrounding governance, and Git records product revisions and delivery. Graph-free lanes do not acquire RippleGraph state merely because they share the broader workflow model.

## Composition and Concurrency

A workflow may be independent, isolated alongside other work, or focused as the repository’s primary governed activity.

Composition must preserve authority. A parent workflow may delegate bounded work to children, but child authority cannot exceed the approved parent objective. Independent callables retain separate identities and mutation boundaries.

Concurrency is permitted only when ownership remains unambiguous and independent work cannot silently interfere with another workflow’s state or product changes.

## Recovery and Completion

Durable artifacts and workflow state must be sufficient to understand and resume interrupted work without relying on private agent memory.

Repeated operations should recover or converge safely rather than duplicate authority, evidence, or delivery. Ambiguous ownership, changed approved content, or uncertain execution state fails closed until the boundary is restored.

Completion produces the durable outcome appropriate to the selected lane. Some lanes leave only an agreed document, while governed delivery lanes may also leave evidence, review, and an exact Git revision.

## Design Choices

- Human authority remains outside the workflow engine.
- Workflow identity is distinct from individual execution Attempts.
- Durable repository artifacts outrank private provider state.
- Statefulness is introduced only when recovery or governance justifies it.
- Concurrency is based on ownership isolation, not available compute alone.
- Workflow lanes share this model while retaining distinct authority and lifecycle semantics.
