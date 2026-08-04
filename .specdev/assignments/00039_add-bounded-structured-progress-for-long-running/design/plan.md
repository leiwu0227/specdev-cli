# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

1. **T-1 — Define bounded Attempt progress telemetry (AC-1, AC-2).** Add a provider-neutral progress module that validates an optional, size-limited public milestone at the cache boundary, retains only the last valid milestone, classifies controller activity as fresh, quiet, or stale, and writes one bounded ignored runtime projection without affecting durable Attempt status.
2. **T-2 — Project live progress from worker and reviewer execution (AC-1, AC-2).** Integrate the shared progress result into spawned-agent execution, provide providers an optional cache milestone contract, and emit periodic human text or structured JSON-line projections from the same object while preserving final command JSON on stdout and all existing lifecycle outcomes.
3. **T-3 — Add focused regression evidence and delivery receipts (AC-1, AC-2).** Cover valid, absent, malformed, oversized, sensitive, quiet, and stale milestones plus bounded human/structured formatting; after repository-required confirmation, run only the focused verification command and record honest receipts, deviations, risks, and acceptance results.
