# Plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Build one deterministic standalone delivery receipt (AC-1, AC-2).** Aggregate the frozen contract and approved review identity, validated delivery artifacts, the existing Git delivery boundary, grouped commit-owned project paths, unresolved risks, durable artifact paths, and final worktree state into one bounded result object. Preserve missing or ambiguous evidence explicitly instead of inferring success.
2. **T-2 — Project the receipt through both completion paths (AC-1, AC-2).** Make human output and `--json` output render the same receipt object after first-run delivery and after resumed completion, without changing provider, review, lifecycle, verification, or delivery-commit authority.
3. **T-3 — Add focused regression coverage and record evidence (AC-1, AC-2).** Extend the standalone implementation recovery fixtures to assert deterministic human/JSON projections, delivery identity, evidence summaries, changed-path grouping, worktree cleanliness, and resume reuse without an extra provider call or commit. Run only the focused command if repository-required confirmation is available.
