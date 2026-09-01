# Implementation plan

Fresh knowledge search: `specdev knowledge search 'foreground inline assignment implementation execution mode'`.

Relevant fresh result paths:

- `.specdev/project_notes/big_picture.md` — current project architecture and workflow constraints.
- `.specdev/assignments/00057_add-a-stateless-roadmap-lane-that-collaborates-w/outcome.md` — verified interruption precedent for preserving a completed plan and continuing only remaining foreground work.

Historical investigation evidence:

- Git revision `d97742a` and its Assignment `00068` delivery artifacts. This is comparison evidence only; the approved contract and current source govern the fresh implementation, and removed protected-architecture machinery is excluded.

**Implementation Guides:** []

**Review Guides:** []

## Tasks

1. **T-1 — Resolve and freeze execution mode (AC-1, AC-3).** Add strict provider-neutral repository and machine-local configuration for `auto`, `inline`, and `spawned`; preserve worker/reviewer profile precedence; resolve standalone `auto` to inline and Mission execution to spawned; reject invalid, conflicting, fixed-policy-incompatible, retry-incompatible, and post-boundary mode changes before ambiguous product ownership; and freeze the decision at the Git boundary with a bounded spawned reason.
2. **T-2 — Implement foreground ownership and compatible recovery (AC-2, AC-3).** Return complete resumable inline Design/Implementation obligations without launching a worker, validate foreground-authored artifacts on rerun, preserve legacy spawned results and spawned retry semantics, and route inline artifact, review-repair, and resolver continuations back to the foreground owner while retaining independent review, acceptance accounting, and delivery gates.
3. **T-3 — Expose execution facts and align installed surfaces (AC-1, AC-2, AC-3).** Include configured/effective mode, source, bounded reason, current owner, and recovery action in status, next/continue output, candidate/final receipts, installed configuration, lifecycle graph guidance, help, README, and generated platform instructions.
4. **T-4 — Add focused regression coverage and finalize delivery artifacts (AC-1, AC-2, AC-3).** Extend focused configuration, implementation/recovery, status, repair, receipt, and installed-guidance tests. Do not execute tests without explicit user approval; record any unavailable verification as skipped, update progress and outcome exactly, and keep full-suite execution outside this Attempt unless separately authorized.
