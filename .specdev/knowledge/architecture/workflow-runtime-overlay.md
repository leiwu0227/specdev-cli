# Workflow Runtime Overlay

## Summary
SpecDev now installs a declarative `.specdev/workflow.yaml` and exposes `specdev next --json` as the canonical next-action contract for agents.

## Key Decisions
- Keep the existing `.specdev/assignments/<id>/brainstorm|breakdown|implementation|capture` layout.
- Validate the workflow manifest before computing next actions; missing manifests synthesize the default workflow, but malformed or incompatible manifests block with `workflow_manifest_invalid`.
- Derive `next_action` guide, command, gate, and artifact evidence from validated manifest steps.
- Reuse stable structured review choices for checkpoint JSON and `next --json` checkpoint-ready states.
- Surface implementation `phase:end` hooks as non-blocking `hook_outcomes` so optional repo knowledge prompts are visible without bypassing gates.

## Key Files
- `templates/.specdev/workflow.yaml`
- `src/utils/workflow-runtime.js`
- `src/commands/next.js`
- `src/commands/checkpoint.js`
- `tests/test-checkpoints.js`

## Source
- Assignment: 00021_familiarization_workflow-review
- Phase: implementation
