# Workflow Diff — Discussions + .current pointer
**Date:** 2026-03-12  |  **Assignment:** 00003_refactor_mandatory-assignment-flag

## What Worked
- TDD discipline caught several integration issues early (e.g., `.current` not being set in test fixtures caused cascade failures across 3 test suites — tests surfaced this immediately)
- Breaking down into 14 tasks kept each change small and reviewable
- The `SPECDEV_DISCUSSION` env var approach for reviewer subprocesses was clean — avoids changing reviewer config templates

## What Didn't
- Codex reviewer repeatedly flagged the same two false-positive findings across all 3 rounds (design dispute about two-path assignment creation, and test failures caused by stale global binary). Max rounds exhausted without resolution, requiring manual override. Consider adding a mechanism for the main agent to flag disputed findings so the reviewer can differentiate "acknowledged but disagreed" from "not addressed".
- The codex reviewer used the globally-installed `specdev` binary (v0.0.4) instead of the local dev version, causing phantom test failures. Need `npm link` before reviewloop, or the reviewer config should handle this.
- Test migration from `--assignment` flag to `.current` pointer required touching 3 test files with repetitive `setCurrent()` additions — could have been a single utility import if test helpers were better organized.
