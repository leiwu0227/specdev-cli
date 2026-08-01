# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Add reusable Mission compatibility evaluation (AC-1, AC-2).** Model the current controller protocol, read the pinned root graph package from durable run state, conservatively evaluate controller outputs reachable from the current Mission phase, and classify compatible, known migratable, and unknown incompatible packages with stable next-action data.
2. **T-2 — Enforce compatibility at Mission run/status and transition boundaries (AC-1, AC-2).** Return first-class human/JSON `migration-required` or `workflow-incompatible` results before controller/provider creation, recheck immediately before durable graph transitions, and preserve Mission delivery status/disposition on incompatibility while allowing `mission-lifecycle@1.4.0` to continue unchanged.
3. **T-3 — Add focused regression fixtures and delivery receipts (AC-1, AC-2).** Cover known and unknown mismatch output, provider-spawn and transition barriers, non-mutation, status semantics, and the compatible 1.4.0 path; record authorized verification or the repository-mandated skip in `progress.json` and summarize acceptance evidence in `outcome.md`.
