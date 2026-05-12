# Thin Runtime Guidance Implementation Plan

> **For agent:** Backfilled after implementation. The code changes are already complete in commit `a6db37f`.

**Goal:** Make SpecDev thinner and more deterministic by routing phase transitions through `specdev next --json`, reducing heavy phase guidance, and replacing mandatory final distillation with optional phase-end knowledge capture.

**Architecture:** The runtime contract in `src/utils/workflow-runtime.js` and `src/utils/state.js` owns navigation. Source templates under `templates/.specdev/` provide focused phase guidance. Tests pin the high-value workflow contract surfaces without broad snapshots.

**Execution Mode:** inline

---

### Task 1: Route Guidance Through Runtime Contract
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- `src/commands/approve.js`
- `src/commands/check-review.js`
- `src/commands/init.js`
- `src/commands/reviewloop.js`
- `src/utils/commands.js`
- `templates/.specdev/_main.md`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/skills/core/brainstorming/SKILL.md`
- `templates/.specdev/skills/core/breakdown/SKILL.md`
- `templates/.specdev/skills/core/implementing/SKILL.md`
- `templates/.specdev/skills/core/reviewloop/SKILL.md`
- `README.md`

**Work:**
- Replace duplicated phase transition prose with `specdev next --json` handoffs.
- Preserve checkpoint, approval, and reviewloop gate behavior.
- Keep installed `.specdev` runtime state out of the source commit.

**Verify:**
- `node ./tests/test-workflow-contract-drift.js`

**Test Budget:**
- focused (<30s)

**Test Pruning:**
- Update drift assertions instead of adding broad prose snapshots.

**Commit:** `a6db37f refactor: thin workflow runtime guidance`

### Task 2: Thin Breakdown And Implementation Task Model
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- `src/commands/implement.js`
- `templates/.specdev/skills/core/breakdown/SKILL.md`
- `templates/.specdev/skills/core/implementing/SKILL.md`
- `templates/.specdev/skills/core/implementing/prompts/implementer.md`
- `templates/.specdev/skills/core/implementing/scripts/complete-task.sh`

**Work:**
- Replace mandatory full test/code task plans with concise task contracts.
- Add `lightweight`, `standard`, and `full` mode behavior.
- Remove mandatory batches of 3 and batch test-suite prompts.
- Add test budget and prune-and-replace rules.

**Verify:**
- text-only scan for removed heavy-contract phrases.

**Test Budget:**
- text-only

**Test Pruning:**
- No new tests needed; this is guidance and command text cleanup.

**Commit:** `a6db37f refactor: thin workflow runtime guidance`

### Task 3: Make Knowledge Capture Optional Phase-End Guidance
**Mode:** full
**Skills:** test-driven-development
**Files:**
- `src/utils/workflow-contract.js`
- `src/utils/state.js`
- `src/utils/workflow-runtime.js`
- `templates/.specdev/workflow.yaml`
- `templates/.specdev/skills/core/knowledge-capture/SKILL.md`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/_index.md`
- `README.md`
- `tests/test-checkpoints.js`
- `tests/test-init.js`
- `tests/test-workflow-contract-drift.js`

**Work:**
- Remove `capture` as a required canonical runtime phase.
- Make implementation approval complete the assignment.
- Surface optional non-blocking `phase:end` knowledge hooks for brainstorm, breakdown, and implementation.
- Rewrite knowledge capture around search-first, user approval, and prune-and-replace.
- Keep `distill` as a legacy helper for old capture diffs.

**Verify:**
- `node ./tests/test-workflow-contract-drift.js`
- `node ./tests/test-checkpoints.js`

**Test Budget:**
- focused (<30s)

**Test Pruning:**
- Update existing checkpoint/drift tests rather than adding new suites.

**Commit:** `a6db37f refactor: thin workflow runtime guidance`

### Task 4: Documentation And Contract Drift Cleanup
**Mode:** lightweight
**Skills:** []
**Files:**
- `README.md`
- `templates/.specdev/_guides/assignment_guide.md`
- `templates/.specdev/_index.md`
- `templates/.specdev/_main.md`
- `templates/.specdev/_templates/gate_checklist.md`
- `templates/.specdev/knowledge/_index.md`
- `templates/.specdev/skills/README.md`

**Work:**
- Update docs from four-phase workflow to three-phase workflow with optional phase-end knowledge capture.
- Mark distill as legacy where still exposed.
- Align help and index descriptions with the new task and knowledge model.

**Verify:**
- text-only scan for old mandatory capture/distill wording.

**Test Budget:**
- text-only

**Test Pruning:**
- No test changes for this docs-only task.

**Commit:** `a6db37f refactor: thin workflow runtime guidance`
