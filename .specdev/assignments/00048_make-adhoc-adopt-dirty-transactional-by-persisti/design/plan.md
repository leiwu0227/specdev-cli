# Implementation plan

**Implementation Guides:** [api-security]

**Review Guides:** []

## Tasks

### T-1 — Persist an exact adoption authorization manifest (AC-1)

Expand Git status with untracked-file enumeration into canonical repository-relative path entries and preserve each entry's starting status. Classify the complete requested set before creating Adhoc state, reject every concurrent-callable or otherwise unsafe path atomically with its owner/reason/recovery action, and persist the accepted versioned manifest with the starting revision. Keep accepted human output bounded while returning the complete manifest in JSON.

### T-2 — Commit through an exact, failure-safe path transaction (AC-2)

Build the finish candidate from the required manifest plus the currently valid Adhoc delta and receipt, reject missing required or protected paths, stage only literal authorized paths in a temporary index, compare the staged set exactly, create the delivery commit from that verified tree with a compare-and-swap HEAD update, and synchronize only committed paths back to the caller's index after success. Persist enough pre-commit candidate state for deterministic retry and fail closed for legacy adopted Adhocs without an exact manifest.

### T-3 — Verify fresh and recovered delivery facts before completion (AC-2, AC-3)

Derive requested, committed, rejected, and remaining facts from the durable manifest, candidate authorization, actual Git commit, and post-commit status. Require the delivery parent, exact commit path set, protected-path exclusion, required adopted subset, and remaining owned delta to validate before clearing active state; apply the same checks to a recovered trailer commit. Generate human and JSON receipts from those verified facts rather than operator prose, and align installed Adhoc guidance with the transactional behavior.

### T-4 — Add focused transactional regression coverage and receipts (AC-1, AC-2, AC-3)

Extend the command-level Adhoc fixture for multi-file untracked directories, spaces, renames, deletions, protected Discussion/Test Audit and RippleGraph paths, exact manifest persistence, injected/missing path refusal, pre-existing index preservation on failure, exact commit contents, remaining-delta blocking, and fresh/recovered completion. Run only the focused command after explicit repository-required approval; otherwise record it as skipped without claiming acceptance evidence. Inspect the final diff and write the exact progress and outcome receipts.
