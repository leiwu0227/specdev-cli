# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

1. **T-1 — Model the authority pause and exhaustive nested dispositions (AC-1, AC-3).** Add an identity-bearing `awaiting-user-reapproval` Assignment result, a Mission decision gate, and a composition invariant proving every schema-valid child disposition matches exactly one parent edge while preserving genuine failure routes.
2. **T-2 — Implement durable approve/reject and provider-free resume behavior (AC-1, AC-2).** Persist the complete reviewed-candidate identity and disclosure taxonomy, surface it through Mission run/status, reject stale identities before mutation, record auditable decisions, and make approval/rejection retries idempotent while reusing existing evidence.
3. **T-3 — Preserve installed-workflow compatibility and document the command surface (AC-2, AC-3).** Version the Assignment and Mission graph packages, migrate supported active Mission checkpoints (including nested frames) to the new packages, and update CLI help and workflow guidance for the semantic commands.
4. **T-4 — Add focused regression coverage and record evidence (AC-1, AC-2, AC-3).** Cover classification, unchanged resume, exact approval/rejection and stale refusal, exhaustive nested routing, restart behavior, and graph migration; run only user-approved focused checks and record exact receipts in `implementation/progress.json` and `outcome.md`.
