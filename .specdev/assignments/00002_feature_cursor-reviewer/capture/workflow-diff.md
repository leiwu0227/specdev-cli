# Workflow Diff — Cursor Reviewer
**Date:** 2026-03-11  |  **Assignment:** 00002_feature_cursor-reviewer

## What Worked
- Config-driven reviewer architecture made adding a new reviewer trivial — just one JSON file
- Brainstorm phase was appropriately scoped for a small feature
- Dry-run testing of cursor-agent during brainstorm caught important info about the hang issue and auth requirements before implementation
- TDD discipline was straightforward — tests were simple and implementation was minimal

## What Didn't
- Codex reviewer sandbox can't capture `spawnSync` stdout/stderr, causing false test failures during reviewloop. This is a pre-existing issue affecting all `test-reviewloop-command.js` assertions, not specific to cursor changes. The codex sandbox environment doesn't reproduce the same test results as running locally.
- The breakdown phase auto-detected all 3 tasks as `full` mode (likely because task 3 is the last task), but the tasks were so simple that standard mode would have been sufficient
