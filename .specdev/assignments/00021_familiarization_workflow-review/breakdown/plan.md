# Workflow Runtime Overlay Implementation Plan

> **For agent:** Implement this plan task-by-task using focused verification. Do not run the full test suite repeatedly; use targeted tests for touched behavior and record any broader run that was intentionally skipped.

**Goal:** Implement the approved workflow review direction as a narrow proof of concept: a deterministic next-action runtime overlay, structured gate choices, and agent guidance that starts assignments through command-created folders.

**Architecture:** Keep the existing `.specdev/` structure and phase artifacts. Add an installed workflow manifest plus runtime utilities that can synthesize the default workflow when no manifest is present. Expose the runtime through `specdev next`, and reuse the same choice data from checkpoint JSON while preserving current human-readable checkpoint output.

**Tech Stack:** Node.js ESM CLI; `yaml` for manifest parsing; existing SpecDev command tests.

**Execution Mode:** inline

---

### Task 1: Add workflow manifest and next-action runtime
**Mode:** standard
**Skills:** [test-driven-development]
**Files:**
- Create: `templates/.specdev/workflow.yaml`
- Create: `src/utils/workflow-runtime.js`
- Create: `src/commands/next.js`
- Modify: `src/commands/dispatch.js`
- Modify: `src/utils/commands.js`
- Modify: `src/commands/help.js`
- Modify: `src/utils/update.js`
- Modify: `src/commands/update.js`

**Step 1: Write focused coverage**
Update focused command tests so initialized projects include `workflow.yaml` and `specdev next --json` reports a canonical next action.

Run: `node ./tests/test-init.js && node ./tests/test-checkpoints.js`
Expected: FAIL before implementation if `workflow.yaml` or `next` is missing.

**Step 2: Implement the runtime**
Add the manifest template, runtime loader/validator/default workflow, and `specdev next` command.

**Step 3: Verify focused behavior**
Run: `node ./tests/test-init.js && node ./tests/test-checkpoints.js`
Expected: PASS.

### Task 2: Add structured checkpoint choices and command-created assignment guidance
**Mode:** standard
**Skills:** [test-driven-development]
**Files:**
- Modify: `src/commands/checkpoint.js`
- Modify: `src/commands/init.js`
- Modify: `tests/test-checkpoints.js`
- Modify: `tests/test-init.js`

**Step 1: Write focused coverage**
Assert checkpoint JSON includes stable choice ids and generated assignment skills prefer `specdev assignment "<desc>" --type=<type> --slug=<slug>` followed by `specdev next --json`.

Run: `node ./tests/test-init.js && node ./tests/test-checkpoints.js`
Expected: FAIL before implementation if structured choices or guidance are missing.

**Step 2: Implement the behavior**
Reuse runtime choice construction in checkpoint JSON and update generated command-skill prose.

**Step 3: Verify focused behavior**
Run: `node ./tests/test-init.js && node ./tests/test-checkpoints.js`
Expected: PASS.

### Task 3: Pin contract drift for the runtime overlay
**Mode:** standard
**Skills:** [test-driven-development]
**Files:**
- Modify: `tests/test-workflow-contract-drift.js`

**Step 1: Write focused coverage**
Assert the installed manifest declares the workflow contract version, preserves gate fields, and exposes the first hook slot.

Run: `node ./tests/test-workflow-contract-drift.js`
Expected: FAIL before manifest coverage exists.

**Step 2: Implement drift assertions**
Add narrow assertions without broadening the test suite.

**Step 3: Verify focused behavior**
Run: `node ./tests/test-workflow-contract-drift.js`
Expected: PASS.
