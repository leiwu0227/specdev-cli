# Roadmap Todo Design

Add `.specdev/project_notes/roadmap/todo.md` as the Roadmap-owned list for future
non-architecture work explicitly requested by the user.

Todo uses Forecast's compact shape: a `# Todo` title, dependency-ordered numbered
sections, and fewer than 200 words per item. When dependencies do not determine the
order, user priority decides it. Todo items omit provenance metadata; the forecast's
required `Based on:` design-note references do not carry over.

The two files have distinct authority:

- `forecast.md` contains implementation gaps derived from approved architecture.
- `todo.md` contains user-selected work that does not require an architecture note.

Todo entries do not create design authority, implementation authority, workflow
state, receipts, or completion history. Moving an item between Todo and Forecast
requires reclassification under the destination's authority rules.

Initialization seeds the empty file; update backfills it without overwriting user
content. Roadmap command output and installed guidance expose it as a standard
writable file with its own item rules.
