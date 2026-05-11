# Reduce Test Suite Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Reduce the top-level test suite to a much smaller smoke/regression suite while preserving coverage for the highest-risk SpecDev workflows.

**Architecture:** Keep command-oriented tests that exercise user-visible CLI behavior, not one file per module. Merge narrow workflow-agent and knowledge tests into retained smoke files, delete redundant implementation-detail tests, and make `npm test` run only the retained suite plus cleanup.

**Tech Stack:** Node.js ESM test scripts run directly with `node`; no separate test framework.

**Execution Mode:** inline

---

### Task 1: Reduce package scripts and top-level test inventory
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify `package.json`; Delete redundant `tests/test-*.js` files; keep existing helpers in `tests/helpers.js`.

**Step 1: Write the failing test**
Use the existing full-suite command as the failing check before deletion:

Run: `npm test`

Expected: FAIL or impractically slow because `package.json` still invokes the broad 35-file suite, including the large reviewloop and many narrow utility tests.

**Step 2: Write minimal implementation**
Update `package.json` so `npm test` runs only these retained scripts:

- `test:init`
- `test:assignment`
- `test:workflow-contract-drift`
- `test:update`
- `test:knowledge`
- `test:workflow-agent`
- `test:approve-phase`
- `test:checkpoints`
- `test:reviewloop-command`
- `test:cleanup`

Delete scripts for removed files. Delete redundant files:

- `tests/test-agent-runner-subsumption.js`
- `tests/test-agent-runner.js`
- `tests/test-agents-inspect.js`
- `tests/test-context.js`
- `tests/test-current.js`
- `tests/test-discuss.js`
- `tests/test-discussion.js`
- `tests/test-distill.js`
- `tests/test-focus.js`
- `tests/test-hook.js`
- `tests/test-host-detection.js`
- `tests/test-json-medium.js`
- `tests/test-json-simple.js`
- `tests/test-memory.js`
- `tests/test-research.js`
- `tests/test-review-feedback.js`
- `tests/test-review-focus.js`
- `tests/test-reviewloop-focus.js`
- `tests/test-reviewloop-runner.js`
- `tests/test-reviewloop-stream-json.js`
- `tests/test-reviewloop.js`
- `tests/test-scan.js`
- `tests/test-scripts.js`
- `tests/test-skills.js`
- `tests/test-utils.js`
- `tests/test-workflow-contract.js`
- `tests/test-workflow.js`

Keep or create:

- `tests/test-init.js`
- `tests/test-assignment.js`
- `tests/test-workflow-contract-drift.js`
- `tests/test-update.js`
- `tests/test-knowledge.js`
- `tests/test-workflow-agent.js`
- `tests/test-approve-phase.js`
- `tests/test-checkpoints.js`
- `tests/test-reviewloop-command.js`

**Step 3: Run targeted script validation**
Run: `node -e "const p=require('./package.json'); if (!p.scripts.test.includes('test:workflow-agent')) process.exit(1); console.log(p.scripts.test)"`

Expected: PASS and prints the reduced `npm test` chain.

**Step 4: Commit**
Do not commit until all tasks pass and implementation review is approved.

### Task 2: Merge retained workflow-agent and knowledge smoke coverage
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Create `tests/test-workflow-agent.js`; Modify `tests/test-knowledge.js`.

**Step 1: Write the failing tests**
Create `tests/test-workflow-agent.js` with smoke coverage for:

- a valid local agent spec through `specdev agents inspect <path> --json`
- invalid agent metadata rejection
- one successful `specdev research` artifact creation using a fake runner
- malformed first runner output followed by retry success

Modify `tests/test-knowledge.js` so it also covers the essential memory/distill smoke paths formerly covered by separate files:

- `specdev memory refresh --json` generates `project_notes/working_memory.md`
- `specdev distill --assignment=<id> --json` emits capture summaries from assignment capture files
- `specdev distill done --assignment=<id> --json` marks a completed assignment processed

Run: `node ./tests/test-workflow-agent.js && node ./tests/test-knowledge.js`

Expected: FAIL before implementation if the files/scripts are missing or if merged assertions are not yet wired correctly.

**Step 2: Write minimal implementation**
Build the new workflow-agent file by moving only the essential setup helpers and assertions from `test-agent-runner.js`, `test-agents-inspect.js`, and `test-research.js`.

Keep `test-knowledge.js` command-level and compact. It should create one isolated project under `tests/test-knowledge-output`, initialize it as needed, and avoid duplicating every edge case from deleted files.

**Step 3: Run merged smoke tests**
Run: `node ./tests/test-workflow-agent.js && node ./tests/test-knowledge.js`

Expected: PASS.

**Step 4: Commit**
Do not commit until all tasks pass and implementation review is approved.

### Task 3: Trim high-cost retained tests and verify reduced suite
**Mode:** full
**Skills:** [test-driven-development, systematic-debugging]
**Files:** Modify `tests/test-reviewloop-command.js`, optionally `tests/test-assignment.js`; Modify `package.json` cleanup paths.

**Step 1: Write the failing test**
Run: `npm test`

Expected: FAIL or run too slowly if retained tests still include redundant heavyweight sections, stale cleanup paths, or deleted test references.

**Step 2: Write minimal implementation**
Trim `tests/test-reviewloop-command.js` to retain only high-value command behavior:

- missing/invalid phase handling
- reviewer listing and JSON listing
- preflight blocking for missing command
- stale feedback guard and changelog pass-through
- approved verdict with auto-approval
- needs-changes verdict
- reviewer timeout or timeout env override smoke
- reviewer log capture
- stdout salvage smoke
- implementation phase approval smoke
- multi-reviewer chain stop/skip smoke
- `check-review` reviewer selection smoke

Delete repeated variants that cover the same branch. If `tests/test-assignment.js` remains too broad, keep only assignment creation, `.current`, selector, and discussion promotion coverage.

Update `test:cleanup` to include only retained output directories.

**Step 3: Run verification**
Run: `npm test`

Expected: PASS in this environment.

Run: `find tests -maxdepth 1 -name 'test-*.js' | wc -l`

Expected: prints `9`.

**Step 4: Commit**
Do not commit until implementation review and capture are complete.
