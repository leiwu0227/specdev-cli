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

The current 2,200-line command cap is a transitional compatibility ceiling. New
review responsibilities should be extracted into focused modules so the cap can
decrease over time.

## Source Targets

- `src/commands/reviewloop.js` — maximum 2200 lines — review orchestration, preflight, and role prompts.
- `src/utils/review-convergence.js` — maximum 240 lines — bounded automatic-stage state.
- `src/utils/reviewer-continuation.js` — maximum 450 lines — candidate-bound reviewer session leases.
- `src/utils/result-envelope.js` — maximum 260 lines — strict review outcome parsing.
