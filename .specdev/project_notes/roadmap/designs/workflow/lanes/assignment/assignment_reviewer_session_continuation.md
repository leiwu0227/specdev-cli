# Assignment Reviewer Session Continuation

Parent design: `./assignment_lane.md`

## Purpose

Reviewer-session continuation reduces repeated orientation when an independently reviewed Assignment returns for a bounded repair.

It preserves review independence while allowing the same reviewer lineage to retain useful context across closely related rounds. Continuation is an optimization, not a source of authority or a replacement for durable review artifacts.

## Continuation Model

The first primary implementation review starts with a fresh independent reviewer. When that review produces repair findings and the Assignment presents a repaired version of the same candidate, the next primary round may continue the same reviewer session.

The continued reviewer receives the prior findings, the change from the reviewed candidate to the repaired candidate, and any changed evidence. It must inspect the repair and consider regression risk rather than assuming earlier understanding remains sufficient.

Each invocation remains a distinct Attempt and review round. Session continuity does not merge their outcomes or make an earlier verdict apply to a later candidate.

## Authority and Isolation

Continuation is limited to one Assignment, one reviewer role, one reviewed baseline, and one frozen review policy. It never crosses Assignment boundaries, resumes an implementation-author session, or shares context between independent reviewer roles.

Resolvers, arbiters, workers, and unrelated reviewers begin with fresh role context. Retained conversation cannot broaden filesystem, network, model, or approval authority.

## Invalidation and Fallback

A material change to the contract, product scope, review policy, authority, or unrelated candidate state invalidates continuation and requires a fresh full review.

Missing, expired, unsupported, mismatched, or failed session continuity also falls back to fresh review. Durable contracts, evidence, candidate identity, findings, and workflow state must always be sufficient to reconstruct that review.

Session continuity is replaceable operational state. Its loss may cost time, but it cannot block recovery or erase the authoritative review record.

## Design Choices

- The first primary review is always fresh and independent.
- Continuation applies only to bounded repair verification.
- Every invocation remains a distinct Attempt and review round.
- Material authority or candidate change forces fresh review.
- Durable artifacts outrank provider session memory.
- Failed continuation degrades safely to a full review.
