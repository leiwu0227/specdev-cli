## Round 1

- Fixed [F1.1]: `specdev next --json` now includes a structured `interaction` choice contract for `brainstorm_checkpoint_ready` and `implementation_checkpoint_ready` states, reusing the existing stable choice ids from `buildReviewChoices`.
- Fixed [F1.2]: malformed `.specdev/workflow.yaml` parse errors are caught and returned through the existing `workflow_manifest_invalid` blocked JSON path instead of throwing a YAML stack trace.

Verification:
- `node ./tests/test-checkpoints.js` — 42 passed, 0 failed.

## Round 2

- Fixed [F2.1]: `validateWorkflowDefinition` now validates that `hooks` is an array before iterating, returning the existing `workflow_manifest_invalid` blocked JSON shape for type-invalid manifests such as `hooks: 123`.

Verification:
- `node ./tests/test-checkpoints.js` — 45 passed, 0 failed.

## Round 3

- Fixed the reviewer-reproduced null hook entry crash: `validateWorkflowDefinition` now validates each hook entry is a mapping/object before reading required fields, returning the existing `workflow_manifest_invalid` blocked JSON shape for manifests such as `hooks:\n  -`.

Verification:
- `node ./tests/test-checkpoints.js` — 48 passed, 0 failed.

## Round 4

- Fixed [F4.1]: `validateWorkflowDefinition` now validates the manifest phase map, required core phases, required step arrays, step object shape, and the core step/gate fields used by `specdev next --json`, returning the existing `workflow_manifest_invalid` blocked JSON shape for manifests such as `phases: 123`.

Verification:
- `node ./tests/test-checkpoints.js` — 51 passed, 0 failed.

## Round 5

- Fixed [F5.1]: existing scalar or empty `.specdev/workflow.yaml` files now validate as invalid manifests instead of silently falling back to `DEFAULT_WORKFLOW`; only a missing manifest synthesizes the default workflow.

Verification:
- `node ./tests/test-checkpoints.js` — 57 passed, 0 failed.

## Round 6

- Fixed [F6.1]: `specdev next --json` now surfaces matching implementation `phase:end` hooks at the implementation-to-capture boundary as non-blocking `hook_outcomes`, including the installed `repo_knowledge_prompt` advisory hook with an explicit `skipped` outcome.

Verification:
- `node ./tests/test-checkpoints.js` — 60 passed, 0 failed.

## Round 7

- Fixed [F7.1]: `specdev next --json` now derives action kind, guide/command, gate, and artifact evidence from the validated workflow manifest step selected by the detected state, while preserving the existing state mapping.
- Fixed [F7.2]: workflow manifests now must declare `workflow_contract_version: 1`; missing or unsupported versions return the existing `workflow_manifest_invalid` blocked JSON shape.

Verification:
- `node ./tests/test-checkpoints.js` — 65 passed, 0 failed.
