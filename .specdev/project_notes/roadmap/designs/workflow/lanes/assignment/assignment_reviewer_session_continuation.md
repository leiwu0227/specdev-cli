# Assignment Reviewer Session Continuation

Parent design: `./assignment_lane.md`

Reviewer continuation reduces repeated orientation after a bounded repair while
preserving the independence and candidate specificity of governed review. It is an
optional performance optimization, never durable authority.

The first primary implementation review is fresh. When that reviewer returns repair
findings and the same Assignment presents a repaired form of the same candidate, the
next primary round may reuse the provider session. The reviewer receives prior
findings plus bounded candidate and evidence deltas and must assess both repair and
regression risk.

A continuation lease freezes Assignment, reviewer role, provider profile, review
policy, baseline candidate identity, session ID, and expiry. The lease is claimed
atomically so concurrent reviewers cannot reuse it. Each invocation still creates a
new Attempt and review round; the previous verdict never transfers.

Material contract, scope, policy, authority, or unrelated product change invalidates
continuation. Missing, expired, malformed, mismatched, unsupported, or failed session
state falls back to a fresh reviewer. Resolvers, arbiters, workers, and unrelated
Assignments never inherit the session.

Candidate snapshots and deltas are bounded projections. Durable contracts, evidence,
findings, candidate receipts, and review artifacts remain sufficient for a fresh
review when the lease disappears.

## Source Targets

- `src/utils/reviewer-continuation.js` — maximum 450 lines — lease creation, claim, invalidation, and candidate delta.
- `src/commands/reviewloop.js` — maximum 2200 lines — continuation admission and reviewer invocation.
