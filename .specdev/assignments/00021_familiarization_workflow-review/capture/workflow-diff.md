# Workflow Diff - 00021_familiarization_workflow-review
**Date:** 2026-05-12  |  **Assignment:** 00021_familiarization_workflow-review

## What Worked
- The brainstorm discussion converged on a simple four-primitive model: phases, steps, hooks, and gates.
- Gate checks and reviewloop autocontinue preserved the deterministic phase transitions while allowing implementation findings to be fixed in focused rounds.
- Focused command-level tests were enough to validate the new runtime, checkpoint JSON choices, update coverage, and manifest edge cases without rerunning the full suite repeatedly.

## What Didn't
- The global `specdev` binary did not know the newly added `next` command during development; local verification needed `node ./bin/specdev.js` until the CLI is updated or installed.
- Several review rounds found patch-stacked manifest validation holes. The final implementation is simpler after consolidating around one manifest validator and deriving `next_action` from validated manifest steps.
- Review command artifact paths are printed assignment-relative, which can be momentarily confusing in this repo because assignment artifacts live under `.specdev/assignments/`.
