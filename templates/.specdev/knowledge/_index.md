# Living knowledge

Repository maintainers curate current Markdown under `faq/`, `architecture/`,
`codestyle/`, `domain/`, and `workflow/`. `workflow_feedback/` records concise
reusable SpecDev process observations. FAQ entries use `_templates/faq.md` and
may declare `verified_at`, `review_after`, applicability, source outcomes, and
explicit supersession through `status: superseded` and `superseded_by`.

Completed Assignment and Mission outcomes are searchable history; they are not
automatically promoted into living truth. `specdev knowledge distill` prepares a
bounded read-only brief of completed outcomes and hash-valid completed
Discussion designs not cited by active knowledge, plus stale FAQs. The current
coding CLI classifies and edits Markdown; there is no spawned distillation
agent, confidence engine, processed ledger, or automatic rewrite.

`specdev knowledge rebuild` derives ignored `cache/knowledge.sqlite` from
Markdown. Search rebuilds it synchronously when missing or stale. Default search
uses authoritative current notes, fresh FAQs, and verified outcomes. Use
`--include-stale` only when older guidance is useful and verify it before reuse;
use explicit scopes for broader history, superseded entries, or workflow
material.
