# Implementation Review: SQLite Knowledge Retrieval

## Round 1

**Verdict:** approved

### Spec Compliance

All success criteria from the design spec are satisfied:

- `specdev knowledge index` creates `.specdev/cache/knowledge.sqlite` and exits 0
- `specdev knowledge search "<query>"` returns ranked matches with path, kind, assignment ID, and snippet
- `specdev knowledge search --json "<query>"` returns valid JSON
- `.specdev/.gitignore` (both template and live) ignores `cache/`
- Tests cover indexing, search, missing-database guidance, unknown subcommand, and command dispatch/help
- Non-goals respected: no embeddings, no remote services, no source code indexing, no chunks

### Findings

1. [F1.1] MINOR — `readOnly` option on `DatabaseSync` constructor (`knowledge.js:80`) depends on a relatively recent addition to `node:sqlite`. The existing `loadSqlite()` guard handles missing `node:sqlite` entirely, but if a user has a Node version where `node:sqlite` exists but `readOnly` is not yet supported, the search path would throw unexpectedly. Low risk in practice since both features shipped together, and the design accepts "use a Node version that provides node:sqlite" as the contract.

2. [F1.2] MINOR — FTS5 special characters in user queries (e.g., `*`, `OR`, `NEAR`, unbalanced `"`) are passed through to MATCH unescaped (`knowledge.js:94`). Malformed FTS5 syntax will surface as a raw SQLite error. Acceptable for v1 agent callers, but worth noting for future hardening if human CLI usage grows.

3. [F1.3] MINOR — The `--limit` parameter is wired internally (`searchKnowledgeIndex` accepts `options.limit`) but not exposed as a CLI flag. Design spec doesn't require it, so this is fine for v1. Clean internal API for future use.

### Architecture Assessment

- **Modularity:** Clean separation between core logic (`src/utils/knowledge.js`) and CLI layer (`src/commands/knowledge.js`). Core module exports `buildKnowledgeIndex`, `searchKnowledgeIndex`, and `collectKnowledgeDocuments` — the first two form the public API, the third enables direct testing.
- **Patterns:** Follows existing codebase conventions — `resolveTargetDir`/`requireSpecdevDirectory` for context, `--json` flag for machine output, `process.exitCode` for non-zero exits, command registration via `dispatch.js` + `commands.js` + `help.js`.
- **Transaction safety:** Full rebuild under a single transaction with rollback-on-error. Simple and correct for v1.
- **Test coverage:** Fixture-based integration tests cover the golden path (index + search), edge cases (missing index, unknown subcommand), and both output formats (human + JSON). Tests follow the project's existing `assert`/`runSpecdev` helper pattern.

### Addressed from changelog

- (none -- first round)
