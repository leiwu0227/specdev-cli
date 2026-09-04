# Project Orientation

Parent design: `./workflow_model.md`

Project orientation establishes the durable `big_picture.md` context required before
SpecDev creates new Assignment, Discussion, or Test Audit work. Mission guidance
requires agents to read this context when starting a Mission, but Mission creation is
not gated on the document being filled. Later agents gain a stable project-level
anchor without forcing every lightweight request to load broad context.

The `start` command launches or resumes the versioned orientation workflow. The
workflow first inspects whether the project context exists and is meaningfully
filled, then asks the foreground agent and user to complete the durable document, and
finally validates readiness. The coding CLI authors this context interactively; no
separate provider Attempt owns the user's project intent.

Readiness is structural and deliberately small. Placeholder-only or missing context
blocks the gated identities with an explicit next action. Existing focused workflows
resume primarily from their contracts and artifacts, loading the big picture only
when project-wide intent is materially relevant or changed.

The context document explains product purpose, users, architecture, technology, and
important conventions. It remains project-owned Markdown, preserved by update and
changed only through user-authorized work. Generated summaries may quote or link it
but never replace it.

Orientation is a recoverable graph because project context may require several
interactive passes, yet it grants no product mutation authority beyond its own
document. Completion records readiness rather than a product delivery.

## Source Targets

- `src/commands/start.js` — maximum 80 lines — orientation workflow entry and resume.
- `src/utils/project-context.js` — maximum 40 lines — durable context readiness checks.
- `templates/.specdev/workflows/project-orientation/graph.json` — maximum 90 lines — recoverable orientation lifecycle.
- `templates/.specdev/project_notes/big_picture.md` — maximum 120 lines — installed context seed.
