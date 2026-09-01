# Test Audit Lane

Parent design: `workflow_lanes.md`

## Purpose

Test Audit evaluates whether tests are redundant, disproportionately costly, obsolete, or no longer the best protection for current behavior.

It turns an informal cleanup idea into a reviewable analysis and a possible future Assignment contract without granting authority to remove or rewrite tests. Test Audit is specialized analysis, not a test-deletion workflow.

## Authority

Test Audit may inspect product code, tests, test infrastructure, and relevant repository history. Product code and tests remain read-only throughout the lane.

Its write authority is limited to its own audit and proposed Assignment artifacts. Recommendations do not become implementation authority merely because the audit is complete or identifies convincing savings.

The user explicitly selects Test Audit. An agent must not infer permission to start one from a general request to explain test coverage or review a test file.

## Workflow Shape

Test Audit is an isolated RippleGraph callable with a durable identity, recoverable state, and terminal boundary. It never becomes the focused scheduler and may coexist with delivery work because its product boundary is read-only.

The callable preserves the evolving analysis until the user is satisfied that its conclusions and proposed contract are ready. Completion freezes a durable recommendation rather than performing repository mutation.

## Audit Model

Redundancy is a protection question, not a similarity judgment. Two tests that look alike may protect different behavior, failure modes, environments, or compatibility boundaries. A removal candidate is justified only when the retained test system continues to provide the intended protection.

Each recommendation therefore explains:

- why the candidate is redundant or no longer valuable;
- which retained protection covers the relevant behavior;
- the expected maintenance or execution-cost effect;
- uncertainty and confidence in the conclusion.

The audit distinguishes safe removal candidates from consolidation opportunities, uncertain cases, and tests whose unique protection should remain.

## Artifacts and Completion

The audit artifact records findings, evidence, tradeoffs, and retained protection. A companion Assignment contract translates only the recommended mutation into a bounded future authority proposal.

Completion means the user accepts the analysis as ready for possible promotion. It does not mean the tests have been changed, the proposed contract has been approved, or its assumptions remain permanently current.

Completed artifacts represent the concluded audit and should not be silently rewritten afterward.

## Concurrency and Freshness

Test Audit may coexist with focused workflows, Discussions, and graph-free work because it owns isolated artifacts and no product mutation.

Concurrent code or test changes may invalidate its evidence. Promotion therefore revalidates the relevant repository state rather than assuming the completed audit still describes the current candidate.

Its artifacts remain outside Adhoc and Assignment ownership unless a fresh destination workflow explicitly adopts their bounded proposal.

## Promotion

Promotion creates a fresh Assignment identity and copies the proposed contract as provenance. Normal contract review and user approval remain required before any test mutation begins.

The new Assignment may refine the proposal when revalidation exposes changed facts, but material changes require the user to approve the resulting contract rather than inheriting the old audit conclusion silently.

## Design Choices

- Analysis and deletion authority remain separate.
- Retained protection matters more than textual duplication.
- Recommendations include cost, confidence, and uncertainty.
- Isolated read-only state enables safe concurrency.
- Promotion creates fresh authority and revalidates current evidence.
