# Assignment Candidate Preflight

Parent design: `./assignment_lane.md`

## Purpose

Candidate preflight determines whether an Assignment’s implementation artifacts and acceptance evidence are complete enough to enter review.

It keeps predictable evidence repair with the implementation owner instead of creating reviewer state or consuming reviewer effort for a candidate that is not yet reviewable.

## Design

Preflight occurs at the boundary between implementation and review. It evaluates the complete candidate through the same interpretation of artifacts and evidence used by later review and delivery checks.

A complete candidate may advance to review. An incomplete candidate remains in implementation and receives a bounded explanation of what must be repaired. No reviewer, review round, verdict, or review-repair allowance is created for that failed boundary.

The behavior is independent of execution mode. Inline work returns to the foreground implementation owner; delegated work remains with its established worker boundary. Preflight does not transfer ownership or create a new executor.

## Evidence Model

The implementation evidence record preserves chronological history, including failures and later retries. Candidate summaries may present a bounded view of current obligations, but display limits never decide whether evidence is complete.

Later evidence may satisfy an earlier failed obligation only when it represents the same authority and candidate context. Qualification evidence cannot silently replace required acceptance evidence.

Candidate identity remains bound to the complete authoritative artifacts rather than only their summary.

## Defensive Validation

Review and final delivery repeat the same candidate validation. The earlier preflight prevents avoidable review churn, but it does not replace protection against resumed historical work, changed artifacts, or mutation after the first check.

Any identity change or newly incomplete evidence fails closed and returns to the appropriate owner.

## Design Choices

- Reviewability is established before reviewer resources are used.
- Evidence repair remains an implementation responsibility.
- Historical evidence is preserved while current obligations may be summarized.
- One shared interpretation prevents implementation, review, and delivery from disagreeing.
- Preflight changes workflow timing, not test authority, review independence, or delivery gates.
