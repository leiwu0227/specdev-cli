# Implementation plan

**Implementation Guides:** [api-security]

**Review Guides:** []

## Tasks

1. **T-1 — Model evidence-only observation completion (AC-1).** Add an explicit Mission queue classification and validate complete negative-observation provenance before allowing a child to return as completed with required follow-up; preserve failed acceptance evidence, reject ordinary/incomplete children, and route the durable signal into the existing gap/repair/final-verification progression.
2. **T-2 — Add fail-closed successor adoption planning (AC-2).** Implement the public `mission adopt-successor` read-only planning surface and validate Mission/blocked-child lifecycle, standalone successor authority and review, candidate ancestry, exact command and environment evidence, artifact identities, scoped changes, ambiguity, and semantic snapshot freshness without tracked mutation.
3. **T-3 — Apply journaled successor adoption (AC-3).** Add explicit confirmation of the frozen plan, content-addressed supersession provenance, idempotent crash recovery, nested RippleGraph return, Mission gap and queue updates, status/history visibility, and no-rerun/no-delivery-commit behavior while preserving excluded dirt.
4. **T-4 — Document and cover the bounded behavior (AC-1, AC-2, AC-3).** Update CLI help and installed workflow guidance, add focused command-level regression scenarios for eligible/ineligible observation completion, adoption rejection, valid adoption, stale confirmation, dirt preservation, interruption recovery, and replay, then record only user-authorized verification receipts.
