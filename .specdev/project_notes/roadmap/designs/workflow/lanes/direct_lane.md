# Direct Lane

Parent design: `./workflow_lanes.md`

## Purpose

Direct handles work whose authority is already complete in the user’s immediate request and whose consequences do not justify governed workflow state.

It is the normal lane for questions, explanations, status, read-only inspection, and bounded documentation that records or clarifies existing behavior without changing product semantics.

Direct keeps lightweight work lightweight. It is a real lane with an explicit authority boundary, not an absence of classification.

## Authority

Direct may inspect the repository and answer from current evidence. It may create or revise a bounded non-behavioral documentation artifact when the user requests that artifact.

Its authority does not include functional product changes, public-contract changes, workflow transitions, shared design decisions, or mutation of state owned by another lane. File extension and location do not determine this boundary; the meaning and consequence of the change do.

A request to explain behavior may inspect implementation, but inspection does not authorize modification. A request to document behavior may record what exists, but it does not authorize redefining that behavior.

## Workflow Shape

Direct is stateless. It creates no workflow identity, RippleGraph state, lifecycle receipt, or approval record. It does not reserve the focused scheduler and does not pause, advance, or terminate active governed work.

The immediate user request is the authority. If the request changes materially during execution, the work is reclassified rather than silently expanding Direct.

Direct work uses only the context needed to answer or produce the requested artifact. Broad project orientation is unnecessary unless the question or an unresolved fact requires it.

## Durable Outcome

Many Direct interactions leave no repository artifact. When Direct writes documentation, that document is the durable outcome.

Direct does not automatically create a Git commit. If the user explicitly requests one, the commit is ordinary repository history scoped to the requested artifact; it is not a SpecDev delivery, carries no lane receipt, and grants no additional mutation authority.

## Selection and Escalation

Direct is appropriate when an imperfect result is easy to inspect and correct and no durable governance boundary is needed.

Work moves to another lane when it requires product mutation, collaborative design approval, durable evidence, independent review, recoverable workflow state, or broader coordination. The agent may recommend that escalation, but the user selects the governed lane.

Importance alone does not force workflow state. Conversely, a small textual edit is not Direct when it changes behavior, authority, compatibility, or another normative contract.

## Concurrency

Because Direct owns no scheduler or lifecycle, it may occur alongside other work. It must preserve the authority and artifacts of every active lane and cannot use its stateless nature to bypass their mutation boundaries.

## Design Choices

- Immediate user authority is sufficient only for bounded non-governed work.
- Semantic impact, not file type or size, determines eligibility.
- Read-only understanding does not imply mutation authority.
- Direct leaves no workflow history merely to prove that simple work occurred.
- Explicit escalation is preferred over silently adding ceremony or silently broadening scope.
