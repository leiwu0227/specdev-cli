# Project Notes Diff - 00018_feature_workflow-agents
**Date:** 2026-05-11  |  **Assignment:** 00018_feature_workflow-agents

## Gaps Found
- `big_picture.md` described skills and scripts but did not yet mention agents as a third workflow primitive. Add an architecture-level note for path-based agent specs, `agent-runner`, and the first `specdev research` command.
- `big_picture.md` dependency notes were stale after the implementation: `yaml` and `ajv` are now runtime dependencies, and `js-yaml` is no longer the listed package dependency.
- `feature_descriptions.md` and `assignment_progress.md` did not include the completed workflow agents feature.

## No Changes Needed
- Existing reviewloop, workflow-contract, knowledge, memory, and command-handler architecture notes already cover the surrounding systems this feature builds on.
