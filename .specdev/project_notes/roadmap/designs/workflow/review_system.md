# Review System

Parent design: `./workflow_model.md`

SpecDev review evaluates an exact candidate against approved authority, acceptance
evidence, and a frozen review policy. Only a review launched through the governed
reviewloop may authorize a workflow transition; native provider review output is
advisory.

The first required review is fresh and independent. Reviewers receive read-only
product authority, bounded artifacts, role instructions, and a strict result
envelope. Preflight validates reviewer configuration, executable availability,
timeout, and writable review destinations before spawning a provider.

Interactive mode returns findings to the implementation owner one round at a time.
Automatic mode uses bounded stages: primary review, optional artifact repair,
resolver execution, and fresh arbitration. Limits prevent an unbounded repair loop.
Each invocation is a distinct Attempt and review round, even when supported session
continuation preserves context for a closely related repaired candidate.

Review artifacts record candidate identity, findings, verdict, profile, and round.
Repair invalidates the earlier candidate; the next round receives relevant prior
findings and evidence deltas without inheriting the old verdict. Malformed envelopes,
reviewer writes, provider failure, changed authority, or exhausted convergence
return a blocked outcome rather than approval.

Brainstorm review is normally optional and never grants user approval. Assignment
implementation review defaults to required unless the exact approved contract
freezes a supported waiver. Mission child review and parent convergence preserve the
same independence and evidence rules.

Existing reviews also assess unnecessary scope or machinery. Brainstorm review
distinguishes concrete needs from speculative commitments; implementation review
checks complete delivery and identifies behavior-preserving simplifications. A useful
finding names a concrete alternative and explains why it preserves required behavior
and architectural boundaries. A single implementation, caller, or export alone does
not prove that an abstraction or file is unnecessary.

Line counts, file counts, and stylistic preferences remain advisory. Complexity
blocks only when supported by an actual defect or binding requirement violation.
Do not prolong review to pursue smaller diffs or expand candidate review into a
repository cleanup. Simplification preserves validation, security, accessibility,
error handling, and required evidence. Apply this judgment in existing review rounds
without introducing another reviewer, score, artifact, or gate.

The current 2,200-line command cap is a transitional compatibility ceiling. New
review responsibilities should be extracted into focused modules so the cap can
decrease over time.

## Source Targets

- `src/commands/reviewloop.js` — maximum 2200 lines — review orchestration, preflight, and role prompts.
- `src/utils/review-convergence.js` — maximum 240 lines — bounded automatic-stage state.
- `src/utils/reviewer-continuation.js` — maximum 450 lines — candidate-bound reviewer session leases.
- `src/utils/result-envelope.js` — maximum 260 lines — strict review outcome parsing.
- `templates/.specdev/guides/review.md` — maximum 45 lines — concrete, behavior-preserving simplicity findings.
