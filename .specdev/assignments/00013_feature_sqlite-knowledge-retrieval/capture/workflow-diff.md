# Workflow Diff — SQLite Knowledge Retrieval
**Date:** 2026-05-08  |  **Assignment:** 00013_feature_sqlite-knowledge-retrieval

## What Worked
- The Hermes-inspired discussion translated cleanly into a narrow implementation slice: document-level SQLite FTS, generated cache, and explicit `knowledge index/search` commands.
- The implementation reviewloop with Claude approved the phase and surfaced useful non-blocking follow-up considerations without derailing the v1 scope.
- Running the full `npm test` suite after focused tests caught no regressions and the previously observed reviewloop-command hang did not recur.

## What Didn't
- The first implementation pass exposed Node's experimental `node:sqlite` warning in command output. The command now suppresses that specific warning so JSON output remains machine-readable.
- The current query path intentionally leaves malformed FTS syntax as a raw SQLite error. A future hardening assignment could normalize or escape FTS query syntax for friendlier agent-facing errors.
