# Implementation plan

## Knowledge consulted

- Fresh bounded search: `specdev knowledge search 'knowledge search precision phrase broad fallback diagnostics repository evidence curation invalidation'`.
- `.specdev/knowledge/architecture/sqlite-knowledge-retrieval.md` — retained the document-level SQLite FTS boundary and Markdown authority model.
- `.specdev/assignments/00053_add-a-dedicated-knowledge-curation-workflow-that/brainstorm/contract.md` and `outcome.md` — preserved the existing content-addressed proposal, approval, publication, and rebuild lifecycle.
- `.specdev/project_notes/big_picture.md` — confirmed the current command architecture, installed-template ownership, and focused command-level test convention.

The search produced only low-coverage broad matches, so each relevant lead above was checked against current `src/`, `templates/.specdev/`, and focused test code before implementation. No stale or superseded guidance was used.

**Implementation Guides:** [api-security]

**Review Guides:** []

## Tasks

1. **T-1 — Add explicit precise and broad search semantics (AC-1).** Safely parse all-term and quoted-phrase queries, preserve explicit broad any-term discovery, deterministically rank complete/phrase matches ahead of partial fallback, bound fallback results, and expose mode, coverage, matched terms/phrases, tier, and refinement guidance in compatible text and JSON output without changing authority, scope, freshness, supersession, or stale eligibility.
2. **T-2 — Bind repository evidence into curation proposals (AC-2).** Add a minimal project-relative repository-evidence input and proposal schema; validate the Git boundary, regular tracked source path, exact bytes, generated/ignored/dirty exclusions, and attributable location; include the evidence identity in proposal approval checks and fail closed when evidence is missing, changed, dirty, or ambiguous while leaving existing durable-source, verification, ownership, publication, receipt, and rebuild authority intact.
3. **T-3 — Update installed workflow guidance and focused fixtures (AC-1, AC-2, AC-3).** Teach Assignment, Mission, and Adhoc templates to narrow noisy retrieval, treat historical matches as leads, inspect current code for hard-coded or closed-world assumptions, and send reusable missing constraints through approved curation without bulk source indexing; extend focused command-level coverage for search modes/diagnostics/fallback and repository-evidence approval invalidation.
4. **T-4 — Collect bounded acceptance evidence and finalize receipts (AC-1, AC-2, AC-3).** Inspect the final diff and, only with the repository-required explicit user confirmation, run the focused knowledge-curation command-level test rather than the full suite; record the exact revision, result, deviations, and unresolved risks in `progress.json` and `outcome.md`.

