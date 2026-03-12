# Workflow Diff — 00004_refactor_specdev-discussion-skill
**Date:** 2026-03-12  |  **Assignment:** 00004_refactor_specdev-discussion-skill

## What Worked
- Codex brainstorm review caught real gaps (missing doc files, unclear skill placement, no backward-compat decision) — all worth addressing
- Pure rename refactor was well-scoped — 6 tasks, clean TDD, no surprises
- Parallel subagent dispatch per task kept implementation fast

## What Didn't
- `.current` pointer was still set to 00003 when starting reviewloop, causing "max rounds reached" on first attempt — easy to miss when creating a new assignment manually instead of via `specdev assignment --type --slug`
- Codex reviewer created a stale `D0001_legacy` discussion folder during its verification (ran `specdev discuss` against the globally installed binary which hadn't been updated) — needed manual cleanup. The known stale-global-binary issue from previous learnings.
