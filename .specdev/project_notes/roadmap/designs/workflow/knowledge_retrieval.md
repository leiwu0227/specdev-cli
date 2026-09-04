# Knowledge Retrieval

Parent design: `./workflow_model.md`

Knowledge retrieval gives agents bounded access to durable project context without
bulk-loading the repository. Authoritative Markdown remains the source of truth; the
SQLite full-text database and generated briefs are replaceable projections.

The collector indexes project context, living knowledge, workflow outcomes,
Roadmap designs, and other supported durable sources with normalized metadata,
content hashes, freshness, and provenance. Generated databases live in ignored
cache. A stale or missing index is rebuilt atomically from Markdown.

Precise search first requires all meaningful terms and supports quoted phrases. If
that query has no result, retrieval returns a small, labeled partial fallback using
any term. Explicit broad search uses any-term matching from the outset. Scope filters
distinguish current guidance from history and workflow records; stale or superseded
sources are excluded unless the caller deliberately includes them. Results are ranked
and bounded rather than used as automatic authority.

Distillation assembles a compact read-only brief for an Assignment, Mission, or
Discussion. It selects relevant project context, unreferenced sources, stale FAQs,
and knowledge paths while preserving links to the owning documents. A brief can
guide inspection but cannot replace a contract, evidence, design, or current source
verification.

Assignment context selection separately combines mandatory authority with objective-
matched Roadmap and knowledge support. Retrieval expands when uncertainty requires
it; it does not make every durable file mandatory context.

The `context` command presents a bounded repository overview for agents using counts
and important paths. It avoids treating generated summaries as a hidden control
plane.

The current 1,000-line retrieval-utility cap is a transitional compatibility
ceiling. New responsibilities should be extracted and the cap reduced as the
implementation is decomposed.

## Source Targets

- `src/utils/knowledge.js` — maximum 1000 lines — collection, indexing, search, freshness, and distillation.
- `src/commands/knowledge.js` — maximum 420 lines — rebuild, search, list, and distill interfaces.
- `src/commands/context.js` — maximum 120 lines — bounded project-context projection.
