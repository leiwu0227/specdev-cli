# Design plan

**Implementation Guides:** none

**Review Guides:** none

## Tasks

1. **T-1 — Define durable review modes and convergence state (AC-1, AC-2).**
   Add a focused review-policy utility that classifies top-level Brainstorm,
   Mission Brainstorm, and Discussion reviews as interactive, classifies
   Mission-child Brainstorm and post-approval reviews as automatic, normalizes
   candidate/findings progress, and deterministically selects the bounded
   primary, conditional-primary, resolver, arbiter, approval, disagreement, or
   objective-failure disposition.
2. **T-2 — Integrate interactive and automatic review control (AC-1, AC-2,
   AC-3).** Remove interactive round lockouts and keep each explicit invocation
   advisory and single-shot. Drive automatic child-Brainstorm and implementation
   reviews through durable repair/resolver/arbiter state, permitting a
   nonblocking disagreement only through the existing strict delivery-evidence
   gate and recording objective failure without requesting user direction merely
   because a round budget ended.
3. **T-3 — Make Mission recovery bounded and graph revisions immutable (AC-2,
   AC-3).** Apply the same automatic convergence decisions to Mission review,
   convert repeated final-verification failure into an explicit terminal
   disposition, bound replanning inside approved authority, bump changed
   workflow package versions, and add focused regression coverage for progress,
   unchanged stalling, blocked arbitration, evidence-safe override, objective
   failure, restart, and interactive reruns.

## Verification

- Focused Node.js tests for the review-policy state machine and graph-package
  versions.
- Focused command/integration coverage for interactive reruns, automatic
  convergence, durable restart, override rejection/acceptance, Mission terminal
  failure, and immutable package installation.
- Tests are not run until the repository-required explicit user confirmation is
  available.
