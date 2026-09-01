# Workflow Lanes

Parent design: `../workflow_model.md`

## Purpose

A workflow lane is a user-facing specialization of the SpecDev workflow model. It gives a class of work a clear purpose, authority boundary, state model, concurrency policy, and durable outcome.

Lanes let SpecDev apply the lightest governance that is sufficient for the work. They are different designs, not merely different command names or sizes of the same process.

Each concrete lane has its own design document. This parent defines only their shared dimensions and relationships.

## Shared Dimensions

Every lane is distinguished by:

- **Intent:** the kind of work the lane exists to support.
- **Authority:** what it may inspect, decide, or mutate.
- **Workflow shape:** stateless collaboration, one-shot transaction, isolated callable, or focused workflow.
- **Concurrency:** whether it may coexist with other work or owns the focused scheduler.
- **Approval:** how user authority is established and where it must be renewed.
- **Durable outcome:** what artifacts, evidence, state, or revision remain afterward.

Changing one of these dimensions can materially redefine a lane even if its public name remains unchanged.

## Lane Families

Lanes fall into four workflow families: immediate and stateless work, transactional delivery, isolated callables, and focused workflows. The family describes shared state and concurrency characteristics; each concrete lane still owns its distinct intent and authority.

## Lane Taxonomy

| Lane | Primary intent | Authority shape | Workflow shape |
| --- | --- | --- | --- |
| **Direct** | Answer, inspect, or make a bounded non-behavioral documentation change | Immediate user request | Stateless |
| **Roadmap** | Agree on design direction and future implementation gaps | Roadmap notes only; no implementation authority | Stateless collaboration |
| **Adhoc** | Deliver one bounded governed repository change | Explicitly selected change scope | One-shot transaction |
| **Discussion** | Explore and synthesize a design question | Product read-only; discussion artifacts only | Isolated callable |
| **Assignment** | Deliver one contract-bounded product change | Exact standalone or parent-delegated contract | Focused workflow |
| **Mission** | Coordinate an approved objective through Assignment work | Parent contract delegating bounded child authority | Focused controller |
| **Test Audit** | Analyze redundant testing and prepare possible future work | Product and tests read-only; audit artifacts only | Isolated callable |

## Lane-Independent Governed Actions

The lane taxonomy is not an exhaustive list of approval-bound actions. A governed action may own one narrow authority transition without becoming a user-facing work lane, scheduler, or general-purpose lifecycle.

Knowledge curation is the canonical example. Any lane may reveal a reusable project fact, but publication requires the separate authority defined by `../knowledge_curation.md`. The discovering lane’s approval, evidence, or execution authority does not transfer to curation, and proposing curation does not advance or terminate that lane.

A lane-independent action must define its exact authority, durable outcome, and interaction with active work. If it begins owning a general class of work, product delivery, or a focused lifecycle, it must be evaluated as a lane addition or redefinition instead.

## Selection and Escalation

Lane selection follows authority and risk rather than file extension, line count, or perceived effort. Functional product mutation requires a lane with explicit mutation authority. Greater uncertainty, coordination, evidence, or review needs justify a more governed lane.

The user selects governed lanes. An agent may recommend a lane and explain the tradeoff, but it must not silently create workflow state or broaden authority. Explicit user selection may choose stronger governance than the minimum.

Exploration does not imply implementation. A design or audit may inform later work, but implementation begins under fresh authority appropriate to the destination lane.

## Concurrency and Composition

Only one focused Assignment or Mission scheduler owns primary governed execution at a time. Isolated callables may coexist because their identities and mutation boundaries remain separate. Stateless lanes and Adhoc do not become schedulers merely because they occur alongside focused work.

Composition preserves the parent boundary. Mission delegates work through Assignment contracts; a child lane does not inherit authority beyond the approved parent objective. Moving work between lanes creates a new authority boundary rather than silently carrying approval forward.

## Design Choices

- Lane differences are semantic, not procedural aliases.
- The lightest sufficient lane is preferred, while the user may request stronger governance.
- Read-only exploration and product mutation remain separate authorities.
- Concurrency depends on ownership isolation.
- Parent lane designs define shared rules; child lane documents own concrete behavior.
- Lane-independent governed actions retain separate authority without expanding the lane taxonomy.
