# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Define and validate the exact active-run migration (AC-1, AC-3).** Add a version-specific `mission-lifecycle@1.3.0` to `@1.4.0` planner that validates a non-terminal Mission/run identity, pinned package metadata, current root/child position, queue and gap consistency, pending transitions, and target package availability before producing any writes; reject unsupported, incomplete, ambiguous, or divergent state actionably and without mutation.
2. **T-2 — Apply an in-place journaled migration with safe resume (AC-1, AC-2, AC-3).** Add `specdev mission migrate <id>` with stable human/JSON output, durable atomic progress metadata, explicit root and stack graph-source/node mapping, and idempotent recovery at every write boundary. Preserve existing Mission/run evidence and translate any durable `evidence-closed` transition to `resolve-gap` so ordinary Mission continuation replays it without another provider Attempt.
3. **T-3 — Add focused migration fixtures and delivery receipts (AC-1, AC-2, AC-3).** Extend the focused Mission compatibility test surface for exact preservation, nested/root mappings, each injected write-boundary interruption, idempotent resume, evidence-closure reuse, unsupported/ambiguous/non-terminal validation, and byte-stable failure behavior; record authorized verification or repository-mandated skips in `progress.json` and summarize acceptance evidence in `outcome.md`.
