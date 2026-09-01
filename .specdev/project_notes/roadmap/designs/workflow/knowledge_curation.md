# Knowledge Curation

Parent design: `./workflow_model.md`

## Purpose

Knowledge curation maintains living, reusable project knowledge through an explicit human-authority boundary.

It is a lane-independent governed action rather than a workflow lane. Useful knowledge may be discovered during Direct work, Adhoc, Discussion, Assignment, Mission, Test Audit, or ordinary inspection, but discovery does not authorize publication.

## Knowledge Model

Living knowledge records current project facts that should guide later work: conventions, domain rules, recurring constraints, troubleshooting knowledge, and reusable workflow guidance.

Each fact should have one clear owning note. Curation updates or supersedes that owner instead of creating parallel sources that can silently disagree.

A proposed change identifies:

- the knowledge owner and exact destination;
- the reusable fact being added, changed, or retired;
- durable evidence and current verification supporting it;
- conflicts with existing knowledge; and
- relevant observations intentionally excluded from publication.

This is a conceptual proposal template, not a requirement that every note expose those fields in its final prose.

## Evidence and Authority

Repository inspection may establish that a reusable constraint currently exists, but code does not automatically become shared project memory. Code evidence supports a proposal; it does not replace an owning knowledge source or exact user approval.

Artifacts from another lane may also support curation. Their approval, implementation, or review status does not silently authorize a knowledge update.

The user approves the exact proposed knowledge change and destination. Materially changed content requires renewed approval. Broader project-context records may require a distinct approval boundary because they influence work beyond one knowledge topic.

## Publication and Derived Views

Approved curation updates the owning durable note and leaves a concise receipt connecting the proposal, authority, evidence, and applied result.

Publication is idempotent: repeating the same approved action must not duplicate facts, receipts, or ownership. A partial failure must remain recoverable without treating an unapproved draft as published knowledge.

Indexes and search databases are derived views. They may be rebuilt from authoritative Markdown and must never outrank it. Index failure may reduce discovery quality, but it cannot erase or roll back an approved knowledge record.

## Relationship to Workflow Lanes

Knowledge curation does not acquire product-code mutation authority, advance the lane in which evidence was discovered, or become a hidden child of that lane.

For example, an Assignment may reveal a recurring repository convention. The Assignment can cite that observation, but publishing it for future work requires a separate curation decision. Likewise, knowledge curation cannot update Roadmap designs merely because current code contains an undocumented feature.

Selecting curation temporarily supersedes stateless Roadmap collaboration, but it does not terminate or reinterpret durable workflow identities.

## Design Choices

- Discovery and publication are separate authorities.
- Knowledge has one owning source rather than parallel truth.
- Code and workflow artifacts provide evidence, not automatic publication.
- Exact content and destination are approval-bound.
- Durable Markdown is authoritative; indexes are replaceable projections.
- Curation remains lane-independent and cannot inherit product mutation authority.
- Roadmap design and living knowledge remain distinct forms of project memory.
