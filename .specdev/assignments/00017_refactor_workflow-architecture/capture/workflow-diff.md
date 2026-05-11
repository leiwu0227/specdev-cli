# Workflow Diff - 00017_refactor_workflow-architecture
**Date:** 2026-05-11  |  **Assignment:** 00017_refactor_workflow-architecture

## What Worked
- Reviewloop caught a real contract-boundary gap after the first implementation pass: `check-review` still accepted arbitrary phase strings even though the new contract declared `commandPhases.checkReview`.
- Focused changelog plus re-review worked well. Round 2 verified the fix using targeted workflow/init/contract/checkpoint tests before approving implementation.
- The amended commit kept the product changes together while leaving `.specdev/` runtime review and capture artifacts out of the product commit.

## What Didn't
- The implementation review instructions for Round 2 still displayed a `## Round 1` feedback template, even though the reviewer correctly appended `## Round 2`. This is a SpecDev workflow guidance issue and is captured in `knowledge/workflow_feedback/review-round-template-mismatch.md`.
