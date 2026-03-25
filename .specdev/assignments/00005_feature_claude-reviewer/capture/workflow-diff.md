# Workflow Diff — Claude Reviewer
**Date:** 2026-03-25  |  **Assignment:** 00005_feature_claude-reviewer

## What Worked
- Config-only changes are fast to brainstorm, plan, and implement — the pluggable reviewer system works well
- Following the cursor-reviewer assignment (00002) as a template made this very predictable
- Cursor reviewer worked for implementation review while codex continues to fail due to bwrap sandbox issues

## What Didn't
- Codex reviewer remains broken due to `bwrap: Unknown option --argv0` sandbox issue — failed on both brainstorm and implementation reviews
- The extract-tasks script misidentified task 1's mode as "full" when the plan said "standard"
