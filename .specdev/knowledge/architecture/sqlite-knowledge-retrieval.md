# SQLite Knowledge Retrieval

Assignment 00013 added `specdev knowledge index` and `specdev knowledge search <keywords>` as the first retrieval layer for SpecDev knowledge.

Pattern: markdown under `.specdev/project_notes/`, `.specdev/knowledge/`, `.specdev/assignments/`, `.specdev/discussions/`, `_guides/`, and `skills/` remains the source of truth. `.specdev/cache/knowledge.sqlite` is a generated, disposable SQLite FTS cache that can be rebuilt at any time.

The v1 design is document-level only: no chunks, embeddings, remote services, or curated concept graph. Add those only after real retrieval failures justify the extra complexity.
