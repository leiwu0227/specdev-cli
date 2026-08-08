# Implementation plan

**Implementation Guides:** api-security

**Review Guides:** none

## Tasks

1. **T-1 — Enforce canonical delivery artifacts and classified verification evidence (AC-1, AC-2, AC-5).** Tighten the worker-facing outcome contract and artifact validation, retain an explicit legacy-risk compatibility path, and normalize qualification versus authoritative-acceptance receipts without granting command authority.
2. **T-2 — Add evidence-safe candidate receipt preflight and finalization identity gates (AC-1, AC-3).** Build a bounded candidate receipt before review, route incomplete artifacts to reusable repair, bind review to the candidate identity, revalidate reviewed inputs before the single commit, and emit completion only after a complete final receipt.
3. **T-3 — Surface bounded semantic Attempt progress (AC-4).** Safely derive a fallback milestone from public `Specdev:` announcements and enrich progress with available Task, active command/wait, activity time, and verification counts while retaining the last safe milestone through quiet or stale intervals.
4. **T-4 — Extend reviewer divergence and evidence-integrity semantics compatibly (AC-3, AC-5).** Add the structured scope/procedure/evidence/reapproval taxonomy to reviewer envelopes and receipts, preserve legacy `material_divergence` parsing, and prevent unsafe delivery transitions.
5. **T-5 — Add focused regression coverage and update durable guidance/templates (AC-1, AC-2, AC-3, AC-4, AC-5).** Cover canonical and legacy outcomes, candidate repair/resume and mutation invalidation, classified verification receipts, safe progress extraction, structured and legacy reviewer results, and user-facing terminal states; run only user-approved focused checks.
