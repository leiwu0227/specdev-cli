# Workflow Diff - Reviewer Preflight Checks
**Date:** 2026-05-07  |  **Assignment:** 00009_feature_reviewer-preflight-checks

## What Worked
- The Hermes research discussion gave a clear assignment candidate: reviewer/tool readiness checks mapped directly to an existing SpecDev pain point.
- Writing the explicit `--preflight --json` test first exposed that reviewloop ignored the flag and would spawn the reviewer, which kept the implementation focused on observable behavior.
- Reusing the existing reviewloop test harness made it straightforward to prove that explicit preflight does not create feedback files and that automatic preflight blocks before spawn.
- The implementation checkpoint and `specdev status --json` made it clear when all tasks were complete and when the workflow moved to implementation approval.

## What Didn't
- The assignment plan mentioned modifying `src/utils/reviewers.js`, but the final implementation did not need that file. Future plans should mark such files as optional when ownership is uncertain.
- The first implementation commit happened before implementation approval, so a separate approval-state commit was required. That is workable, but the workflow could document whether approval metadata should be committed before or after the implementation snapshot.
- Missing reviewer binaries remain warning-only by design to avoid breaking shell builtins and test commands. This is practical, but provider-specific health checks would need a separate assignment.
