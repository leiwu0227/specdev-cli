# Workflow Diff — Workflow Status JSON
**Date:** 2026-05-07  |  **Assignment:** 00008_feature_workflow-status-json

## What Worked
- Promoting the Hermes research discussion into a focused assignment kept the first implementation slice small.
- Reusing `continue` state detection avoided duplicating workflow state logic.
- TDD caught the missing command wiring immediately with `Unknown command: status`.

## What Didn't
- The global `specdev` command was stale until `npm link` was run, which reproduced an existing reviewloop/global-binary drift risk.
- The breakdown plan used `**Skills:** [test-driven-development]`, but the progress script parsed the brackets into the skill name. Future plans should use `**Skills:** test-driven-development` or the parser should strip brackets.
