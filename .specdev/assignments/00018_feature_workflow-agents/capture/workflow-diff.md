# Workflow Diff - 00018_feature_workflow-agents
**Date:** 2026-05-11  |  **Assignment:** 00018_feature_workflow-agents

## What Worked
- Splitting the feature into template/contract, runner, command wiring, inspect command, and verification tasks kept the implementation reviewable and made it easy to isolate focused test failures.
- The external reviewloop caught two real runner-contract issues after the initial full suite passed: timeout completion needed to wait for child close, and required H2 sections needed order validation.
- The review changelog requirement made the second review straightforward; Round 2 could verify exactly how each finding was addressed.

## What Didn't
- `specdev review implementation` prints artifact paths without the `.specdev/assignments/` prefix, which led the external reviewer to try nonexistent paths before correcting itself. This is low severity but recurring review friction.
- `test:research` is relatively slow because it initializes multiple full fixture projects. It is acceptable for coverage, but it explains why focused review verification can look stalled without heartbeat output.
- `specdev knowledge search "workflow agents researcher agent-runner"` failed during capture with `Error: no such column: runner` even after `specdev knowledge index`; this appears to be the same generated SQLite query issue already tracked in `knowledge/workflow_feedback/knowledge-search-sqlite-json-error.md`.
