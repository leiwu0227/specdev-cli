## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] CRITICAL: `specdev next --json` still does not emit the structured choices promised by the approved plan. The implementation returns `next_action`, `trace`, `blockers`, and `progress`, but no `interaction`/`choices` contract from `computeNextAction` ([src/utils/workflow-runtime.js:222](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:222)). The plan explicitly called for `next --json` to return canonical action data plus structured choices, and the design frames stable choice ids as part of the runtime API. As written, agents still have to infer the decision surface by running checkpoint first and parsing a different command's shape, so the new canonical runtime contract is incomplete. Keep this simple: reuse the same `buildReviewChoices` data for checkpoint-ready states, or expose a clearly named `after_action_choices` field when the next command is a checkpoint.
2. [F1.2] MINOR: malformed `.specdev/workflow.yaml` crashes before the intended manifest-blocker JSON can be returned. `loadWorkflowDefinition` calls `YAML.parse(raw)` without catching parser errors ([src/utils/workflow-runtime.js:87](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:87)), while `computeNextAction` only converts validation errors into `status: "blocked"` payloads after parsing succeeds. That makes `specdev next --json` print a Node stack trace instead of machine-readable recovery guidance when the manifest is syntactically invalid. Catch YAML parse errors and return a failed validation result with the existing `workflow_manifest_invalid` blocker path.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] MINOR: manifest validation still assumes `hooks` is iterable, so a syntactically valid but type-invalid `.specdev/workflow.yaml` can crash before returning the intended `workflow_manifest_invalid` JSON blocker. For example, `hooks: 123` reaches `for (const hook of workflow.hooks || [])` and throws a `TypeError` ([src/utils/workflow-runtime.js:120](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:120)). This leaves a small hole in the same recovery path fixed for YAML parse errors in round 1. Keep the fix narrow: validate that `workflow` is a plain object and `hooks` is either absent or an array before iterating, then report a validation error through the existing blocker shape.

### Addressed from changelog
- Fixed [F1.1]: `specdev next --json` now includes a structured `interaction` choice contract for brainstorm and implementation checkpoint-ready states, reusing `buildReviewChoices`.
- Fixed [F1.2]: malformed YAML parse errors are now caught and returned through the `workflow_manifest_invalid` blocked JSON path.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 42 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.

## Round 3

**Verdict:** needs-changes

### Findings
1. [F3.1] MINOR: manifest validation still assumes every `hooks` entry is an object, so a syntactically valid but type-invalid manifest can still crash instead of returning the intended `workflow_manifest_invalid` JSON blocker. For example, `.specdev/workflow.yaml` with `hooks:\n  -` parses as a hooks array containing `null`; `validateWorkflowDefinition` then reads `hook[field]` and throws a `TypeError` ([src/utils/workflow-runtime.js:132](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:132)). This leaves the same recovery path incomplete after the round 2 fix. Keep the fix narrow: before reading hook fields, validate each hook is a non-null object and report a validation error such as `hook must be an object` through the existing blocker shape.

### Addressed from changelog
- Fixed [F2.1]: `validateWorkflowDefinition` now validates that `hooks` is an array before iterating, returning the existing `workflow_manifest_invalid` blocked JSON shape for type-invalid manifests such as `hooks: 123`.

### Verification
- `node ./tests/test-checkpoints.js` - 45 passed, 0 failed.
- Manual repro: `hooks:\n  -` in `.specdev/workflow.yaml` still throws a `TypeError` from `validateWorkflowDefinition` instead of emitting blocker JSON.

## Round 4

**Verdict:** needs-changes

### Findings
1. [F4.1] MINOR: `.specdev/workflow.yaml` phase shape is still unvalidated and ignored, so a corrupted or incompatible manifest can be reported as valid while `specdev next --json` emits hard-coded default actions. `validateWorkflowDefinition` only validates `hooks` ([src/utils/workflow-runtime.js:127](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:127)), and `computeNextAction` then maps detected assignment state through `actionForDetectedState()` without consulting the loaded manifest phases or steps ([src/utils/workflow-runtime.js:252](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:252)). Repro: a manifest containing `workflow_contract_version: 1`, `phases: 123`, and `hooks: []` returns `status: "ok"` plus `brainstorm.create_artifacts`. This violates the plan's "runtime loader/validator/default workflow" goal and weakens the security/input-validation boundary for an untrusted installed workflow file. Keep the fix narrow: require `phases` to be a mapping when a manifest exists, validate the required core phase/step/gate fields used by `next`, and return the existing `workflow_manifest_invalid` blocker instead of silently falling back to hard-coded defaults.

### Addressed from changelog
- Fixed [F3.1]: `validateWorkflowDefinition` now validates each hook entry is a non-null object before reading hook fields, returning the existing `workflow_manifest_invalid` blocked JSON shape for null hook entries.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 48 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.
- Manual repro: `phases: 123` in `.specdev/workflow.yaml` still returns `status: "ok"` from `specdev next --json`.

## Round 5

**Verdict:** needs-changes

### Findings
1. [F5.1] MINOR: scalar or empty `.specdev/workflow.yaml` files still bypass manifest validation by silently falling back to `DEFAULT_WORKFLOW`. `loadWorkflowDefinition` replaces any parsed non-object value with the default workflow before calling `validateWorkflowDefinition` ([src/utils/workflow-runtime.js:98](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:98)), so a manifest containing `42` reports `workflow.source: "manifest"` and `contract_version: 1` instead of the existing `workflow_manifest_invalid` blocker. This leaves a smaller version of the round 4 corrupted-manifest hole: projects without a manifest should synthesize the default, but projects with an invalid manifest should fail validation. Keep the fix narrow by passing the parsed value through validation as-is, letting the existing `workflow.yaml must contain a mapping/object` error handle null/scalar values.

### Addressed from changelog
- Partially fixed [F4.1]: `validateWorkflowDefinition` now validates `phases` is a mapping/object, validates required core phase steps, and rejects `phases: 123` through the `workflow_manifest_invalid` blocker path.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 51 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.
- Manual repro: a `.specdev/workflow.yaml` containing `42` still does not return `workflow_manifest_invalid`; validation falls through to the next assignment-state blocker instead.

## Round 6

**Verdict:** needs-changes

### Findings
1. [F6.1] MINOR: the implementation-end hook is declared and validated, but `specdev next --json` never surfaces or evaluates it, so the planned hook proof is effectively inert. The manifest installs `repo_knowledge_prompt` at `phase:end` for `implementation` ([templates/.specdev/workflow.yaml:50](/mnt/h/oceanwave/lib/specdev-cli/templates/.specdev/workflow.yaml:50)), but `computeNextAction` only maps detected assignment state to hard-coded actions and interactions ([src/utils/workflow-runtime.js:318](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:318)); for an implementation-approved assignment it jumps straight to `capture.capture_knowledge` with `interaction: null` and no hook outcome. That misses the design constraint that hooks have explicit outcomes (`completed`, `skipped`, `failed`, or `not_applicable`) and the plan item to prove one optional `phase:end` hook with a repo knowledge prompt. Keep the fix narrow: when the runtime reaches the implementation-to-capture boundary, include the matching non-blocking hook as advisory next-action metadata or an `available_hooks`/`hook_outcomes` contract with `not_applicable`/`skipped` defaults, without blocking capture.

### Addressed from changelog
- Fixed [F5.1]: scalar and empty `.specdev/workflow.yaml` files now pass the parsed value through validation and return the existing `workflow_manifest_invalid` JSON blocker instead of falling back to the default workflow.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 57 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.
- Manual repro: after setting both gates approved with capture artifacts missing, `specdev next --json` returns `capture.capture_knowledge` and `interaction: null`, with no `repo_knowledge_prompt` hook or hook outcome.

## Round 7

**Verdict:** needs-changes

### Findings
1. [F7.1] CRITICAL: `specdev next --json` still validates `.specdev/workflow.yaml` but does not use the manifest phase steps to build the canonical `next_action`. `computeNextAction` loads and validates the manifest, then calls `actionForDetectedState(detected.state)`, whose guide paths, commands, and evidence are hard-coded defaults ([src/utils/workflow-runtime.js:320](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:320), [src/utils/workflow-runtime.js:382](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:382)). Repro: change the manifest brainstorm `create_artifacts` guide to `.specdev/custom/brainstorm.md`; `specdev next --json` still returns `.specdev/skills/core/brainstorming/SKILL.md` with `status: "ok"`. That misses the approved design's core runtime-overlay contract: the manifest is supposed to be the phase/step/hook/gate source of truth, so future workflow updates or project-level manifests can safely drive agent behavior. Keep the fix narrow by deriving each action's `kind`, `guide`/`command_line`, and declared `produces` evidence from the validated manifest step, while preserving the existing detected-state mapping.
2. [F7.2] MINOR: manifests with no `workflow_contract_version` are accepted as valid and return `status: "ok"` with `workflow.contract_version: null` ([src/utils/workflow-runtime.js:115](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:115), [src/utils/workflow-runtime.js:381](/mnt/h/oceanwave/lib/specdev-cli/src/utils/workflow-runtime.js:381)). The design called the contract version out as the migration/warning boundary for installed workflows, so accepting a manifest with no declared contract makes incompatible manifests indistinguishable from current-contract manifests until a later behavioral failure. Validate that an existing manifest declares the supported contract version, and route missing or unsupported values through the existing `workflow_manifest_invalid` blocker.

### Addressed from changelog
- Fixed [F6.1]: `specdev next --json` now surfaces matching implementation `phase:end` hooks at the implementation-to-capture boundary as non-blocking `hook_outcomes`, including the installed `repo_knowledge_prompt` advisory hook with an explicit `skipped` outcome.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 60 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.
- Manual repro: changing the manifest `brainstorm.create_artifacts` guide still returns the hard-coded default guide in `next_action`.
- Manual repro: removing `workflow_contract_version` from an otherwise valid manifest still returns `status: "ok"` with `workflow.contract_version: null`.

## Round 8

**Verdict:** approved

### Findings
- (none)

### Addressed from changelog
- Fixed [F7.1]: `specdev next --json` now derives action kind, guide/command, gate, and artifact evidence from the validated workflow manifest step selected by the detected state, while preserving the existing state mapping.
- Fixed [F7.2]: workflow manifests now must declare `workflow_contract_version: 1`; missing or unsupported versions return the existing `workflow_manifest_invalid` blocked JSON shape.

### Verification
- `node ./tests/test-init.js` - 85 passed, 0 failed.
- `node ./tests/test-checkpoints.js` - 65 passed, 0 failed.
- `node ./tests/test-workflow-contract-drift.js` - 36 passed, 0 failed.
- Manual repro: customizing the manifest `brainstorm.create_artifacts` guide returns that custom guide in `next_action`.
