# Workflow Diff — Distill Improvement
**Date:** 2026-03-04  |  **Assignment:** 00001_familiarization_distill-improvement

## What Worked
- Brainstorm-as-investigation approach worked well for a familiarization assignment — no need for proposal/design templates, just investigative notes leading to a concrete design.
- Subagent-driven development for implementation was effective — fresh context per task kept each implementation clean.
- Reviewloop with codex caught two real issues (sort order, already-processed check ordering) that would have been subtle bugs in production.
- TDD discipline with the simple assert-counter test pattern scales well — 38 tests across 11 files with no test framework.

## What Didn't
- Background subagent for Task 5 (continue.js nudge) initially appeared to fail due to stale test output directories causing test-workflow.js failures. The subagent actually committed successfully but the parent session couldn't verify until re-checking. Communication of subagent completion status could be clearer.
- The `specdev review --assignment` flag is parsed as a boolean instead of a string by codex when it constructs the command. Codex runs `specdev review implementation --assignment 00001_...` and the CLI sees `--assignment` as `true`. This is a known CLI parsing bug that should be addressed.
- Reviewloop max_rounds=3 was insufficient — needed a 4th round to confirm fixes from round 3. Consider making this configurable via CLI flag rather than requiring reviewer config file edits.
