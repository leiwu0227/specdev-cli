# Outcome

## Delivered behavior

Adhoc dirty adoption now records a versioned, status-bearing manifest of every expanded eligible path and rejects the entire start when Discussion, Test Audit, or matching RippleGraph call paths are requested. Finish persists its candidate, stages only literal authorized paths through a temporary index, compares the exact staged and commit sets, updates HEAD with a compare-and-swap, and synchronizes only committed paths back to the caller index. Fresh and recovered completion share parent, manifest, candidate, protected-path, receipt, and remaining-owned-delta verification before active state is cleared. Human and JSON output and the committed receipt distinguish requested, committed, rejected, and remaining paths from Git facts.

Focused fixtures were extended for multi-file untracked directories, spaces, renames, deletions, callable ownership rejection, missing and legacy manifests, index preservation, exact commit contents, and blocked/retried recovery. Installed Adhoc guidance and workflow documentation describe the transactional boundary.

## Deviations

None.

## Unresolved risks

The transaction relies on Git's compare-and-swap reference update and exact temporary-index behavior. Concurrent callable namespaces remain protected rather than being silently adopted; users must resolve that ownership separately.

| Acceptance | Evidence                                                                                                                                                     | Result  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| AC-1       | Focused integration tests expand multi-file untracked directories, persist exact status-bearing manifests, and atomically reject Discussion, Test Audit, and callable paths with owner/recovery facts | Passed |
| AC-2       | Focused integration tests cover literal paths, spaces, renames, deletions, missing manifests, temporary-index staging, exact commit sets, compare-and-swap delivery, and caller-index preservation | Passed |
| AC-3       | Focused integration tests exercise fresh and recovered completion, block remaining adopted deltas, verify exact Git commit contents, and assert Git-derived receipt facts | Passed |
