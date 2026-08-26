# Implementation plan

## Knowledge search

- Fresh bounded query: `adhoc assignment coexistence ownership boundary`
- Relevant verified-history paths read:
  - `.specdev/assignments/00048_make-adhoc-adopt-dirty-transactional-by-persisti/outcome.md`
  - `.specdev/assignments/00028_make-reviewer-integrity-and-delivery-boundaries/outcome.md`
  - `.specdev/assignments/00045_remove-the-live-adhoc-workflow-friction-identifi/outcome.md`
- Applied constraints: preserve exact-manifest and temporary-index delivery guarantees, classify concurrent callable state outside Adhoc ownership, and keep workflow-owned paths out of delivery commits.

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

1. **T-1 (AC-1, AC-3):** Add a default-deny focused standalone Assignment resolver for Adhoc start. Validate lifecycle/run/focus consistency, reject an established implementation boundary or live/ambiguous worker/reviewer Attempt, classify Assignment-owned and lifecycle-cleanup paths as preserved, and persist the safe coexistence facts without mutating Assignment state.
2. **T-2 (AC-1, AC-2, AC-3):** Carry the persisted ownership boundary through Adhoc status, finish, recovery, and cancel so exact staging excludes Assignment state and delivery/cancellation leave the same Assignment identity resumable; block Assignment product-advancing commands while the detour is active.
3. **T-3 (AC-2, AC-3):** Update authoritative generated workflow/Adhoc guidance and focused regression fixtures for safe start, finish, cancel, commit ownership, blocking diagnostics, and unchanged Discussion/Test Audit and transactional behavior.
4. **T-4 (AC-1, AC-2, AC-3):** Perform authorized focused verification (or record the repository-required approval blocker), inspect narrow Git evidence, update the release date required for a repository change, and write final progress and outcome receipts.
