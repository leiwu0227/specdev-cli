# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Improve the live knowledge workflow after observed use found relevant Assignments 00079/00080 and Mission M00003 but also returned noisy low-coverage OR matches, while only direct code inspection exposed a reusable hard-coded two-family audit assumption. Make retrieval easier to narrow without losing discovery, and let curation preserve such code-verified implementation constraints as living knowledge.

## Scope and non-goals

- In scope: explicit precise and broad query semantics; phrase preservation; relevance tiers, match diagnostics, and refinement guidance; compatible text and JSON output; content-addressed repository evidence in knowledge-curation proposals; invalidation when that evidence changes; and proportional Assignment, Mission, and Adhoc guidance for search, code verification, and curation follow-through.
- Non-goals: replacing direct code inspection, semantic/vector search, indexing the whole product source tree as knowledge, automatically publishing assumptions, weakening existing freshness/provenance/approval boundaries, or encoding the reported two-family audit detail as SpecDev's own repository knowledge.

## Expected behavior

`specdev knowledge search` supports a clearly reported high-precision path for all-term and quoted-phrase matching and an explicit broad any-term path for discovery. Normal multi-term search prioritizes strong complete or phrase matches and does not let generic one-term matches overwhelm them; when only partial evidence exists, it returns a bounded, visibly labeled fallback with an actionable broad/narrow refinement hint. Each result explains enough of its match—mode, coverage, and matched terms or phrases—for an agent to decide whether to read it. Existing scope, freshness, ranking-authority, text, and JSON behavior remains usable.

When historical knowledge leads to direct code inspection and the reusable constraint is explicit only in current code, `specdev knowledge curate` can bind bounded project-relative repository evidence to the proposal using the inspected revision/content identity and attributable location. Proposal approval is invalidated if that evidence changes. Publication still requires an eligible durable workflow source, exact verification, owner/duplicate checks, destination-specific approval, and the existing automatic rebuild; code evidence cannot silently become living truth by itself.

Installed Assignment, Mission, and Adhoc guidance treats search results as investigation leads rather than substitutes for current-code verification. It tells agents to narrow noisy searches, inspect code for relevant hard-coded or closed-world assumptions, and include reusable missing constraints in the ordinary curation proposal path rather than leaving them only in transient reasoning.

## Important decisions

- Preserve both use cases: precise matching is the normal noise-control path, while explicit broad matching retains the current high-recall ability to locate differently worded historical work.
- Search precision and curation coverage are separate observable changes joined by the demonstrated live workflow: retrieval locates the history, code establishes current truth, and approved curation makes the reusable constraint discoverable next time.
- Repository evidence is content-addressed verification, not a new authority class or an invitation to index arbitrary source code.

## Constraints and invariants

- Queries and phrases are escaped safely into SQLite FTS; invalid or empty precise queries fail clearly rather than silently broadening.
- Strong-result filtering and fallback limits are deterministic, bounded, and visible in both human and JSON output. Freshness, supersession, authority precedence, scope eligibility, and stale opt-in behavior remain intact.
- Repository-evidence paths must stay inside the project, identify regular readable files, and bind exact bytes plus the proposal's Git boundary. Dirty, missing, changed, generated, ignored, or ambiguous evidence fails closed with recovery guidance.
- Curation remains mutation-free until exact user approval. Existing durable-source citation, verification, duplicate-owner, big-picture, publication, receipt, idempotency, and rebuild/recovery invariants continue to apply.

## Delegated and reserved authority

- Delegated: choose concise CLI flag names, deterministic scoring/fallback thresholds, match-diagnostic fields, and the minimal repository-evidence schema that satisfies this contract while preserving compatible broad discovery.
- Reserved for the user: approve exact curated Markdown and any big-picture proposal, or accept a change that removes useful broad discovery, treats unverified code as living truth, or weakens an existing authority boundary.

## Risks and assumptions

- Exact matching can miss paraphrases and broad matching can remain noisy; explicit modes, bounded fallback, and diagnostics must make that tradeoff inspectable rather than claiming semantic understanding.
- A current code constraint can later change, so content-addressed evidence prevents stale approval but does not remove the need for future revalidation and supersession.

## Verification authority

- Focused command-level tests may be proposed; every test command requires explicit user confirmation under repository instructions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: Multi-term and quoted searches provide deterministic precise matching, explicit broad discovery, strong-first bounded fallback, and inspectable match diagnostics in text and JSON while preserving scope, freshness, supersession, authority, and stale opt-in behavior; malformed precision input never silently becomes a broad query.
- AC-2: A curation proposal can attach bounded project-relative code evidence for a reusable constraint discovered through current-code inspection, binds its exact bytes and Git boundary, invalidates approval when it becomes dirty/missing/changed/ambiguous, and publishes only through the existing durable-source, verification, ownership, destination approval, receipt, and rebuild lifecycle.
- AC-3: Installed Assignment, Mission, and Adhoc guidance tells agents to narrow noisy results, verify historical leads against current code, recognize relevant hard-coded or closed-world assumptions, and route reusable missing constraints into approved curation without bulk-indexing source or treating search results as current authority.
