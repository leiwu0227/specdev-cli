# Knowledge Curation

Parent design: `./workflow_model.md`

## Purpose

Knowledge curation maintains living, reusable project knowledge through an explicit human-authority boundary.

It is a lane-independent governed action rather than a workflow lane. Useful knowledge may be discovered during any lane or ordinary inspection, but discovery does not authorize publication.

## Knowledge Model

Living knowledge records current project facts that should guide later work: conventions, domain rules, recurring constraints, troubleshooting knowledge, and reusable workflow guidance.

Each fact has one clear owning note. Curation updates or supersedes that owner instead of creating parallel sources that can silently disagree.

A proposed change identifies:

- the knowledge owner and exact destination;
- the reusable fact being added, changed, or retired;
- durable evidence and current verification supporting it;
- conflicts with existing knowledge; and
- relevant observations intentionally excluded from publication.

This is a conceptual proposal template, not a requirement that every note expose those fields in its final prose.

## Curation Flow

### 1. Scan

Curation begins with a mutation-free, bounded scan. It records the current repository boundary, discovers relevant completed workflow outcomes and existing knowledge owners, and excludes dirty or ambiguous sources. Optional bounded repository evidence may establish a current code fact without turning the source tree into the knowledge base.

### 2. Propose

The agent prepares an exact proposal from the scan. Each change names its owner and destination, supplies the complete intended content, cites eligible durable sources, records current verification, and discloses conflicts and exclusions. Creating, updating, and superseding are explicit actions.

### 3. Validate and Bind

Before approval, curation repeats the scan and validates destinations, ownership, source eligibility, evidence, prior-content identity, and repository freshness. A valid proposal receives a content-derived identity. Any material change produces a different identity and requires fresh validation.

Only one proposal is active at a time. Its recoverable journal is operational state, not published knowledge or authority.

### 4. Approve

The user approves the exact proposal identity. Approval covers only the proposed living-knowledge changes. A broader project-context change requires a separate explicit approval, even when included in the same proposal.

### 5. Publish

Publication revalidates the approved boundary, then atomically applies each selected change. A destination changed since approval is never overwritten. Already-applied content is recognized so interruption and repetition converge without duplicate facts.

### 6. Record and Project

After publication, curation writes a durable receipt connecting proposal, authority, evidence, destinations, and applied content identities. It then rebuilds derived search views from authoritative Markdown.

If rebuilding fails, publication remains valid and the index is marked stale with an explicit recovery action. A failed projection never rolls back approved knowledge.

### 7. Recover or Cancel

Before publication, the active proposal may be inspected, resumed, or cancelled. Once any approved content has been published, cancellation cannot reinterpret that partial result; the same proposal resumes to a receipt and a converged index state.

## Evidence and Authority

Code and workflow artifacts support a proposal but do not automatically become shared project memory. Approval from the source lane does not transfer to curation.

Durable Markdown is authoritative. The proposal journal and search index are replaceable operational views; the receipt is durable publication history. Curation changes neither product code nor the lifecycle of the lane where knowledge was discovered.

## Relationship to Roadmap

Roadmap design and living knowledge are distinct forms of project memory. Knowledge curation cannot modify Roadmap designs or forecast items. Selecting curation temporarily supersedes stateless Roadmap collaboration without terminating or reinterpreting durable workflow identities.

## Design Choices

- Discovery, proposal, approval, and publication are separate authority boundaries.
- Knowledge has one owning source rather than parallel truth.
- Exact content and destination are approval-bound.
- Project-wide context requires separate approval.
- Atomic, idempotent publication favors recoverability over rollback.
- Durable Markdown and receipts outrank journals and indexes.
- Curation remains lane-independent and cannot inherit product or Roadmap authority.
