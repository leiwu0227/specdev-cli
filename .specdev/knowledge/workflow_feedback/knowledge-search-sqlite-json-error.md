# Knowledge Search SQLite JSON Error

Status: open
Type: issue
Severity: major
First seen: 2026-05-10, 00015_feature_claude-reviewer-observability
Last seen: 2026-05-10, 00015_feature_claude-reviewer-observability
Assignments observed: 00015_feature_claude-reviewer-observability

## Observation
- During Knowledge Capture, `specdev knowledge search "reviewloop claude reviewer observability heartbeat stream-json salvage timeout"` failed with `Error: no such column: json`.
- Rebuilding the generated cache with `specdev knowledge index` succeeded, but the same search failed again with the same SQLite error.

## Impact
- Knowledge Capture has a hard requirement to search existing knowledge before writing new notes. When search fails, agents must either stop or manually inspect the markdown tree, which weakens duplicate detection.

## Current Mitigation
- Run `specdev knowledge index` once to rule out a stale cache. If search still fails, inspect `.specdev/knowledge/` directly with `find`/`rg` and record the search failure in the assignment's workflow diff.

## Proposed Action
- create-assignment
