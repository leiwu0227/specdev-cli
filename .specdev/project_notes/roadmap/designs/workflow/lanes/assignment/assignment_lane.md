# Assignment Lane

Parent design: `../workflow_lanes.md`

## Purpose

Assignment delivers one product change under a readable, bounded contract. It is the primary lane when implementation needs explicit scope, durable acceptance criteria, recoverable execution, evidence, and an independent review decision or an approved waiver.

An Assignment is larger in governance than Adhoc, not necessarily larger in code. Its defining feature is the approved contract and the lifecycle that protects it.

## Authority

An Assignment contract is a readable authority template with five parts:

- **Objective:** the outcome the work exists to produce.
- **Scope and behavior:** what may change and what observable result is expected.
- **Constraints:** boundaries the implementation must preserve.
- **Decision boundary:** choices delegated to execution and choices reserved for the user.
- **Acceptance model:** observable criteria, verification boundaries, and required review policy.

A standalone Assignment receives authority from the user’s approval of the exact completed template for one product change.

A Mission-owned Assignment receives bounded authority from its approved parent contract. Child authority may specialize the parent objective but cannot expand it.

Approval binds the exact contract content. A material contract change invalidates earlier approval and requires a new authority decision. Implementation details may be delegated, but product direction, scope expansion, review policy changes, and material divergence remain reserved.

## Workflow Shape

Assignment is a focused RippleGraph workflow with a durable identity and recoverable lifecycle. It occupies the repository’s focused scheduler either independently or as work owned by a Mission.

The user and foreground agent first establish the contract. After approval, an implementation owner plans and executes the change, records acceptance evidence, and prepares a candidate. The candidate is reviewed or validated under the frozen policy before exact delivery.

These are semantic boundaries rather than a script of agent actions. Attempts may fail, be replaced, or resume without replacing the Assignment identity or its approved authority.

## Execution

The implementation owner operates inside the approved contract and a frozen Git boundary. Execution may remain with the foreground coding agent or be delegated to a spawned worker according to the selected execution policy.

Executor choice does not change acceptance, evidence, review, or delivery requirements. Private session continuity is useful operational context but never the sole recovery mechanism.

Planning translates the contract into implementation tasks; it does not redefine the contract. Unexpected findings that materially exceed approved authority return to the user rather than being silently absorbed.

## Evidence and Review

Acceptance evidence connects the delivered candidate to each contract criterion. Evidence history remains durable, while bounded projections may summarize the current candidate for review and delivery.

Candidate completeness is established before reviewer resources are consumed. Required reviewers inspect and report without repairing the candidate they judge. A review waiver may remove the independent reviewer only when the approved policy allows it; it never waives acceptance evidence.

Findings return to the implementation owner for repair. Material divergence creates a visible user decision boundary. Review approval applies only to the exact candidate identity that was inspected.

## Completion and Recovery

Durable contracts, plans, evidence, outcomes, review artifacts, and Git facts make interrupted work understandable without private agent memory.

Successful completion produces one exact delivery revision and a concise durable Assignment outcome. Terminal Assignments remain historical records; materially new work begins under fresh authority rather than reactivating an old approval.

## Concurrency and Composition

Only one standalone Assignment or Mission owns the focused scheduler. Discussion and Test Audit may coexist through isolated read-only state.

Direct and Roadmap have no lifecycle that replaces the Assignment identity. Any changes they leave in the worktree remain under their own authority and must be resolved before the Assignment advances across a Git boundary.

A mutating Adhoc detour follows the narrower boundary defined by the Adhoc lane: it may coexist only at the quiescent approved pre-implementation boundary, and the Assignment cannot advance while Adhoc owns repository mutation.

## Child Designs

- `assignment_execution_modes.md`
- `assignment_candidate_preflight.md`
- `assignment_reviewer_session_continuation.md`
- `assignment_selective_context_catalog.md`

Each child owns one mechanism and inherits the authority, evidence, review, and delivery invariants defined here.

## Design Choices

- One Assignment owns one approved contract and one delivery boundary.
- Exact approval separates delegated implementation from product authority.
- Execution ownership may vary without changing governance.
- Evidence and required review remain independent from implementation authorship.
- Durable artifacts, workflow state, and Git identity provide recovery together.
