# Design: SQLite Knowledge Retrieval

## Overview

SpecDev already captures durable knowledge in `project_notes/`, `knowledge/`, and per-assignment artifacts. That works as a human-auditable source of truth, but it does not give coding agents a retrieval primitive when a project has hundreds of assignments. The new feature adds a generated SQLite cache at `.specdev/cache/knowledge.sqlite` so agents can search relevant prior context on demand.

The database is not authoritative. It is rebuildable from markdown and safe to delete. This keeps SpecDev's existing git-reviewable workflow intact while adding fast local retrieval for agent sessions.

## Goals

- Add `specdev knowledge index` to rebuild a local SQLite FTS index from `.specdev` markdown artifacts.
- Add `specdev knowledge search "<query>"` to return ranked document matches with path, kind, assignment ID, and snippet.
- Keep v1 document-level only; do not introduce chunks, embeddings, or remote services.
- Store generated files under `.specdev/cache/` and ensure initialized projects ignore that directory.
- Update help and command listings so agents can discover the new retrieval commands.

## Non-Goals

- Do not make SQLite the source of truth for knowledge.
- Do not add vector embeddings or model-dependent semantic search.
- Do not index arbitrary repository source code.
- Do not build a curated concept graph in this assignment.
- Do not change existing assignment capture semantics beyond adding a retrieval command agents can run.

## Design

Add a `knowledge` command family routed similarly to `memory` and `skills`. `specdev knowledge index` scans selected `.specdev` markdown files, creates `.specdev/cache/knowledge.sqlite`, and populates two tables: `documents` and `documents_fts`. Documents include project notes, knowledge notes, assignment proposal/design/plan/capture files, discussion proposal/design files, guides, and skills.

The indexer stores relative path, document kind, assignment ID when derivable from the path, phase, title, content, content hash, mtime, and indexed timestamp. It performs a full rebuild in v1 because hundreds of markdown files are cheap to scan and deterministic full rebuilds are easier to trust.

`specdev knowledge search "<query>"` opens the generated database, runs FTS ranking, and prints concise matches. `--json` emits machine-readable results. If the database is missing, the command tells the user to run `specdev knowledge index`.

## Success Criteria

- `specdev knowledge index` creates `.specdev/cache/knowledge.sqlite` and exits successfully.
- `specdev knowledge search "<query>"` returns matching indexed markdown with snippets.
- `specdev knowledge search --json "<query>"` returns valid JSON.
- Initialized `.specdev/.gitignore` ignores `cache/`.
- Tests cover indexing, search, missing database behavior, and command dispatch/help text.

## Testing Approach

Add a focused `tests/test-knowledge.js` that initializes a fixture project, writes representative project notes, knowledge notes, assignment artifacts, and discussion artifacts, runs indexing, then verifies search output and JSON output. Add the test to `npm test`.
