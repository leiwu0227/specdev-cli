# Proposal: SQLite Knowledge Retrieval

Add a generated SQLite retrieval cache for SpecDev knowledge so coding agents can search prior project context without rereading every assignment and markdown note. Markdown remains the source of truth; SQLite is disposable retrieval infrastructure stored under `.specdev/cache/`.

The first version should be deterministic and document-level: index relevant `.specdev` markdown artifacts into an FTS table, expose `specdev knowledge index`, and expose `specdev knowledge search "<query>"` with paths, kinds, assignment IDs, and snippets.
