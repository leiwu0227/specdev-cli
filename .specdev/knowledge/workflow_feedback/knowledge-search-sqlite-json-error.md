# Knowledge Search SQLite JSON Error

Status: fixed
Type: issue
Severity: major
First seen: 2026-05-10, 00015_feature_claude-reviewer-observability
Last seen: 2026-05-11, 00018_feature_workflow-agents
Assignments observed: 00015_feature_claude-reviewer-observability, 00018_feature_workflow-agents

## Observation
- During Knowledge Capture, `specdev knowledge search "reviewloop claude reviewer observability heartbeat stream-json salvage timeout"` failed with `Error: no such column: json`.
- Rebuilding the generated cache with `specdev knowledge index` succeeded, but the same search failed again with the same SQLite error.
- During Knowledge Capture for `00018_feature_workflow-agents`, `specdev knowledge search "workflow agents researcher agent-runner"` failed with `Error: no such column: runner`. Rebuilding with `specdev knowledge index` succeeded, but the search failed again with the same column-derived SQLite error pattern.

## Root Cause
- `src/utils/knowledge.js` passes the raw user query directly into the FTS5 `MATCH ?` expression. SQLite FTS5 treats `-` in unquoted query text as query syntax, not as a literal hyphenated-word character.
- As a result, `stream-json` is parsed as a malformed FTS expression that references `json`, producing `no such column: json`; `agent-runner` similarly produces `no such column: runner`.
- Space-separated equivalents such as `stream json` and quoted FTS phrases such as `"stream-json"` work. Existing knowledge tests only cover space-separated queries, so the hyphenated-term path was not pinned.

## Impact
- Knowledge Capture has a hard requirement to search existing knowledge before writing new notes. When search fails, agents must either stop or manually inspect the markdown tree, which weakens duplicate detection.

## Current Mitigation
- Run `specdev knowledge index` once to rule out a stale cache. If search still fails, inspect `.specdev/knowledge/` directly with `find`/`rg` and record the search failure in the assignment's workflow diff.

## Proposed Action
- none

Suggested fix: normalize user search input into a safe FTS5 query before calling `MATCH`, for example by tokenizing user text and quoting each term/phrase that should be treated literally. Add regression coverage for `stream-json`, `agent-runner`, and mixed queries like `workflow agents researcher agent-runner`.

## Resolution
- Fixed in `src/utils/knowledge.js` by normalizing search input into quoted FTS5 terms before calling `MATCH`.
- Added regression coverage in `tests/test-knowledge.js` for `stream-json`, `agent-runner`, and a mixed query containing `agent-runner`.
