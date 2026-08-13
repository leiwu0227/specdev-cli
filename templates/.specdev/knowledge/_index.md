# Living knowledge

Repository maintainers curate current Markdown under `faq/`, `architecture/`,
`codestyle/`, `domain/`, and `workflow/`. `workflow_feedback/` records concise
reusable SpecDev process observations. FAQ entries use `_templates/faq.md` and
may declare `verified_at`, `review_after`, applicability, source outcomes, and
explicit supersession through `status: superseded` and `superseded_by`.

Completed Assignment and Mission outcomes are searchable history; they are not
automatically promoted into living truth. `specdev knowledge curate` prepares a
bounded read-only scan, validates an exact evidence-backed proposal, waits for
destination-specific user approval, publishes through an idempotent journal,
records a receipt, and rebuilds the disposable index. `knowledge distill`
remains a compatibility-only source brief; it does not publish or spawn an
agent.

Adhoc receipts are intentionally outside the knowledge index. They are concise,
high-volume historical evidence rather than curated guidance. See
`workflow/adhoc-history.md` for bounded receipt and Git searches; promote only a
reusable finding into living knowledge.

`specdev knowledge rebuild` derives ignored `cache/knowledge.sqlite` from
Markdown. Search rebuilds it synchronously when missing or stale. Default search
uses authoritative current notes, fresh FAQs, and verified outcomes. Use
`--include-stale` only when older guidance is useful and verify it before reuse;
use explicit scopes for broader history, superseded entries, or workflow
material.
