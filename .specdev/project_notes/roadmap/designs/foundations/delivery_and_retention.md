# Delivery and Artifact Retention

Parent design: `../core_concepts.md`

Delivery turns an accepted candidate into an exact Git identity without absorbing
unrelated work. It is shared infrastructure used by Adhoc, standalone Assignment,
Mission integration, terminal operations, and maintenance transactions.

A delivery begins from a known revision and an explicit ownership manifest. Git
status is parsed into normalized repository-relative paths, classified by workflow
owner, and compared with the approved or adopted boundary. Staging uses an isolated
temporary index so pre-existing staged state and unrelated dirt are not silently
included.

The commit message carries machine-readable SpecDev trailers appropriate to the
delivery type. After commit, the implementation verifies the new commit's parents,
changed paths, trailers, and expected artifacts rather than trusting command output.
Idempotent recovery locates an already-created commit by identity and completes the
remaining durable state without duplicating delivery.

Acceptance and review artifacts are validated before delivery. A review waiver can
satisfy only the independent-review obligation; it never substitutes for acceptance
evidence. Candidate summaries are bounded projections, while full authoritative
artifacts remain the source for completeness.

Retention follows semantic value. Contracts, outcomes, receipts, evidence summaries,
and terminal history remain durable. Raw provider output, scratch results, completed
RippleGraph runs, and Attempt records may be compacted after their bounded activity
summary and delivery identity are preserved. Compaction occurs after durable
authority, never before it.

Failed or interrupted delivery leaves recoverable journals and does not reinterpret
partial Git state as success. Ambiguous branches, parents, path ownership, or staged
content fail closed.

## Source Targets

- `src/utils/git-delivery.js` — maximum 480 lines — exact staging, commit, and Git identity checks.
- `src/utils/delivery-artifacts.js` — maximum 230 lines — evidence and review artifact validation.
- `src/utils/artifact-retention.js` — maximum 250 lines — safe terminal compaction.
- `src/utils/workspace-changes.js` — maximum 110 lines — workflow-aware path classification.
