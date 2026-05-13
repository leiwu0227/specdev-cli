# Manifest Step Contracts Implementation Plan

> **For agent:** Implement this plan task-by-task. Match verification effort to task mode.

**Goal:** Move per-step interaction schemas, artifact contracts, and post-gate continuation rules out of JS/skill prose and into `workflow.yaml` so the manifest is the single source of truth.

**Architecture:** `workflow.yaml` gains three new contract surfaces per step (`interaction:`, `requires:`/`produces:`, `on_satisfied:`) plus a top-level `interactions:` section and contract version bump to 2. A new `renderStepOutput` helper in `src/utils/workflow-runtime.js` renders text and JSON for all three contracts from manifest data. Every existing consumer (`checkpoint`, `approve-phase`, `review`, `reviewloop`, `state.detectAssignmentState` and its six callers, `continue.collectWorkflowStatus`, `workflow-contract` constants) migrates to read from the manifest; `detectAssignmentState` returns a structured state object (phase/stepId/stepKind/status/gate/blockers/progress) and a derived legacy `state` string for one-release back-compat. A new `.specdev/.session-state.json` carries sticky reviewer/autocontinue across CLI invocations, written only by `reviewloop`, validated against `.specdev/.current` on every read, deleted by terminal-phase `approve` and by `focus` when switching assignments.

**Tech Stack:** Node.js CLI (`src/`), YAML manifest (`templates/.specdev/workflow.yaml` + `.specdev/workflow.yaml`), drift + integration tests under `tests/`, generated skill templates in `src/commands/init.js`, mirrored host skills under `.codex/skills/` and `.claude/skills/`.

**Execution Mode:** inline

**Test Budget:** ≤ 5 new tests across all tasks (default). Per-task allocation: Task 6 (+1 checkpoint snapshot), Task 10 (+1 sticky session-state protocol scaffold), Task 16 (+1 drift expansion covering 4 assertion classes), Task 17 (+1 sticky-reviewer protocol scenarios), Task 18 (+1 mutated-manifest end-to-end). All other migration tasks rely on Tasks 16 and 18 as the gate rather than per-module tests, matching the reduced-test-suite memory.

---

### Task 1: Extend workflow.yaml schema with three new contract surfaces

**Mode:** full
**Skills:** test-driven-development
**Files:** `templates/.specdev/workflow.yaml`, `.specdev/workflow.yaml`, `src/utils/workflow-runtime.js` (or wherever `loadWorkflowDefinition` lives — confirm during work)

**Work:**
- Bump `workflow_contract_version` from 1 to 2 in both manifests.
- Add `interaction:` block to every `kind: command` step that today emits choices via `buildReviewChoices` (brainstorm/review, implementation/review). Use the schema from design.md §Layer 1.
- Add top-level `interactions:` section with `discussion_checkpoint` entry (2-choice schema matching today's `buildReviewChoices('discussion')` output byte-for-byte).
- Add `requires:` to every checkpoint and gate step; ensure `produces:` exists on every guide step.
- Add `on_satisfied:` to every `kind: gate` step with `next.kind`, `sticky`, and `interrupt` fields per design.md §Layer 3.
- Extend `loadWorkflowDefinition` validator to accept and require the new fields on the relevant step kinds; reject manifest if a gate is missing `on_satisfied:` or a checkpoint is missing `interaction:` at contract version 2.

**Verify:**
- `node -e "require('./src/utils/workflow-runtime.js').loadWorkflowDefinition('./.specdev').then(w=>console.log(w.workflow_contract_version))"` prints `2`.
- Manual YAML lint: `node -e "require('js-yaml').load(require('fs').readFileSync('templates/.specdev/workflow.yaml','utf8'))"` returns without throwing.

**Test Budget:** +0; defer drift assertions to Task 16 (test-driven validator behavior is exercised by Task 16's expanded drift test and the integration test in Task 18).

**Test Pruning:**
- None — no existing test asserts schema version yet.

**Commit:** `git commit -m "feat(workflow): add interaction/requires/on_satisfied contracts to manifest v2"`

---

### Task 2: Introduce renderStepOutput helper and structured state contract types

**Mode:** full
**Skills:** test-driven-development
**Files:** `src/utils/workflow-runtime.js`, `src/utils/state.js`

**Work:**
- Add `renderStepOutput(step, runtimeContext, { format })` in `src/utils/workflow-runtime.js`. It emits one of: `interaction` block, `continuation` block, artifact-blocker list. `format` is `'text' | 'json'`. Substitution rules: `{phase}`, `{discussion}`, expansion of `source: reviewers_listing` (read from `.specdev/skills/core/reviewloop/reviewers/`), sticky-state expansion from `.specdev/.session-state.json`.
- Add the structured state contract type (JSDoc typedef) at top of `src/utils/state.js`: `{ phase, stepId, stepKind, status, completedPhases, gate, state (derived legacy), blockers, progress }`.
- No consumers wire to the helper yet — that's Tasks 4-12. This task lands the abstraction with unit-level smoke coverage internal to the module.

**Verify:**
- `node -e "const {renderStepOutput} = require('./src/utils/workflow-runtime.js'); console.log(typeof renderStepOutput)"` prints `function`.

**Test Budget:** +0; covered structurally by Task 16 drift expansion and Task 18 mutated-manifest integration test.

**Test Pruning:**
- None.

**Commit:** `git commit -m "feat(workflow-runtime): add renderStepOutput helper and structured state typedef"`

---

### Task 3: Migrate detectAssignmentState to manifest-driven walk and add loadStateForAssignment

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/utils/state.js`

**Work:**
- Change `detectAssignmentState` signature to `(summary, path, workflowInfo)`; remove the two-argument form. No compatibility shim.
- Replace `artifactPaths.<phase>.<name>` and `gateFields.<phase>` static lookups (lines 31-35, 68, 115) with a walk over the active assignment's phase steps in declared order from `workflowInfo`. For each step, check `requires:` for artifact presence and `kind: gate` + `gate:` for the field to inspect.
- Return the structured state contract (phase, stepId, stepKind, status, completedPhases, gate, blockers, progress) plus a derived legacy `state` string for back-compat. Document in JSDoc that new readers MUST NOT branch on the string.
- Add `loadStateForAssignment(specdevPath, summary, path)` that calls `loadWorkflowDefinition` once and returns `{ workflowInfo, detected }`.

**Verify:**
- `grep -nE "artifactPaths\.(brainstorm|breakdown|implementation)\.|gateFields\." src/utils/state.js` prints nothing.
- Pending broken callers compile (they will break in next task; that's intentional).

**Test Budget:** +0; behavior locked by Task 18 mutated-manifest integration test.

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(state): drive detectAssignmentState from manifest and return structured state"`

---

### Task 4: Migrate all six detectAssignmentState callers to the new signature

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/continue.js`, `src/commands/context.js`, `src/commands/check-review.js`, `src/utils/working-memory.js`, `src/utils/workflow-runtime.js`

**Work:**
- Replace `detectAssignmentState(summary, path)` at each call site with `loadStateForAssignment(specdevPath, summary, path)` (or load `workflowInfo` once at the top of the caller and pass through where the caller already loads it).
- Confirmed call sites: `continue.js:34`, `context.js:94` and `:180`, `check-review.js:30`, `working-memory.js:70` and `:81`, `workflow-runtime.js:327`. Grep before and after to confirm all are migrated.

**Verify:**
- `node -e "const s=require('./src/utils/state.js'); if (s.detectAssignmentState.length !== 3) { console.error('arity wrong:', s.detectAssignmentState.length); process.exit(1) }"` exits 0.
- `grep -rnE "detectAssignmentState\(" src` shows every call site passes three positional args (manual scan); no caller still uses the two-arg form.
- `node -e "require('./src/commands/continue.js')"` loads without crash.

**Test Budget:** +0; covered by Task 18.

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(state): migrate all detectAssignmentState callers to loadStateForAssignment"`

---

### Task 5: Migrate string-state consumers to structured state fields

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/utils/workflow-runtime.js`, `src/commands/continue.js`, `src/commands/context.js`, `src/commands/check-review.js`

**Work:**
- In `workflow-runtime.js`: rewrite `hookOutcomesForState`, `interactionForDetectedState`, `actionForDetectedState`, `buildTrace` to read `detected.phase`, `detected.stepId`, `detected.stepKind`, `detected.status` instead of branching on the legacy state string. Each renderer becomes a `(phase, stepId)` lookup into the manifest.
- `continue.js`: replace `detected.state.startsWith('brainstorm') ? 'brainstorm' : 'implementation'` with `detected.phase`.
- `context.js`: replace prefix-derived phase resolution with `detected.phase`.
- `check-review.js`: replace "anything not brainstorm becomes implementation" with `detected.phase`; reject `null` explicitly with a clear error.

**Verify:**
- `grep -nE "detected\.state\.startsWith|\.state ===" src/commands src/utils` prints nothing (or only inside `state.js` where the derived field is defined).

**Test Budget:** +0; covered by Task 18.

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor: read structured state fields instead of legacy state-name string"`

---

### Task 6: Migrate checkpoint.js to manifest-driven artifacts and choices via renderStepOutput

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/checkpoint.js`, `src/utils/workflow-runtime.js`

**Work:**
- Remove hard-coded artifact lists in `checkpoint.js:100-115` (brainstorm) and `:175-195` (implementation). Derive the required artifact set from the active phase's gate-step `requires:`.
- Remove hard-coded choice prose. Route both text and JSON output through `renderStepOutput` for the manifest step's `interaction:` block.
- Keep the `phase === 'discussion'` JS branch for artifact validation, but route its choice rendering through `renderStepOutput` against the top-level `interactions.discussion_checkpoint` entry.
- Update `buildReviewChoices(phase, { discussion })` in `workflow-runtime.js` to resolve to `interactions.discussion_checkpoint` when `discussion` is set, otherwise to the active phase step's `interaction:` block.

**Verify:**
- `grep -nE "'brainstorm/proposal\\.md'|'brainstorm/design\\.md'|'breakdown/plan\\.md'|'implementation/progress\\.json'" src/commands/checkpoint.js` prints nothing.
- `node bin/specdev checkpoint brainstorm --json` (in a brainstorm-ready test assignment) emits the same labels as the text mode.

**Test Budget:** +1 in `tests/test-checkpoints.js`; focused (<30s). Single snapshot test asserts text and JSON output of `checkpoint brainstorm` and `checkpoint implementation` use byte-identical labels per choice id. Replaces any older narrower assertion.

**Test Pruning:**
- Inspect `tests/test-checkpoints.js` (or `tests/test-checkpoint.js` if singular). Delete any existing per-label assertion that duplicates the new snapshot.

**Commit:** `git commit -m "refactor(checkpoint): render artifacts and choices from manifest via renderStepOutput"`

---

### Task 7: Collapse approve-phase.js into a unified manifest-driven approvePhase

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/utils/approve-phase.js`, `src/commands/approve.js`

**Work:**
- Replace `approveBrainstorm` (line 25) and `approveImplementation` (line 49) with a single `approvePhase(phase, ctx)` that:
  1. Loads the manifest, finds the named phase's `kind: gate` step.
  2. Reads `requires:` and validates artifact presence.
  3. Reads the step's `gate:` field name and writes that field on the assignment status.
  4. Preserves the existing content-level check that implementation has all `tasks[]` complete (this is content validation, not file presence; keep as-is, callable from the unified function).
- Update `src/commands/approve.js` to call the unified function with the phase argument.

**Verify:**
- `grep -nE "approveBrainstorm|approveImplementation" src` prints nothing outside the implementation file's removal diff.
- `grep -nE "gateFields\." src/utils/approve-phase.js` prints nothing.

**Test Budget:** +0; covered by Task 18.

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(approve): collapse per-phase approvers into manifest-driven approvePhase"`

---

### Task 8: Migrate review.js artifact list to derive from manifest

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/review.js`

**Work:**
- `printReviewArtifacts()` (lines 71-79) and the implementation-review artifact list (lines 188-206) read `artifactPaths.brainstorm.proposal`/`.design` and string-literals. Replace with a derivation from the active phase's `requires:` plus the prior phase's `produces:` when the review needs context from upstream artifacts (e.g., implementation review showing design + plan).
- Discussion review keeps its brainstorm-artifact mapping, but routes the rendering through the same helper.

**Verify:**
- `grep -nE "'brainstorm/(proposal|design)\\.md'|'breakdown/plan\\.md'|artifactPaths\\." src/commands/review.js` prints nothing.

**Test Budget:** +0; covered by Task 18 (mutated-manifest test asserts `specdev review <phase>` artifact-list output tracks the manifest).

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(review): derive review artifact lists from manifest requires/produces"`

---

### Task 9: Migrate collectWorkflowStatus and readGateStatus to manifest reads

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/continue.js`, `src/utils/state.js` (or wherever `readGateStatus` lives)

**Work:**
- `collectWorkflowStatus()` (continue.js:203-223) currently reads `workflowArtifactPaths.brainstorm.proposal/.design`, `workflowArtifactPaths.breakdown.plan`, `workflowArtifactPaths.implementation.progress`. Rewrite to enumerate artifacts from each phase's `produces:` + `requires:` blocks in the loaded manifest.
- `readGateStatus()`: rewrite to enumerate fields from every manifest step with `kind: gate`.
- Both functions take `workflowInfo` as input (passed through from the caller, which already has it via `loadStateForAssignment`).

**Verify:**
- `grep -nE "workflowArtifactPaths\\." src` prints nothing outside `src/utils/workflow-contract.js` (the derived-view module per Task 13).
- `node bin/specdev status --json` in a test assignment prints all manifest-declared gates and artifacts, no others.

**Test Budget:** +0; covered by Task 18 (asserts `status --json` `gates` + `artifacts` payload tracks the manifest).

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(status): drive collectWorkflowStatus and readGateStatus from manifest"`

---

### Task 10: Implement sticky session-state CLI protocol

**Mode:** full
**Skills:** test-driven-development
**Files:** `src/commands/reviewloop.js`, `src/commands/approve.js`, `src/commands/focus.js`, plus a new helper module `src/utils/session-state.js`

**Work:**
- Create `src/utils/session-state.js` with `readSessionState({ requireAssignment })`, `writeSessionState(record)`, `clearSessionState()`. Path: `.specdev/.session-state.json`. Reader validates `state.assignment === <current>` from `.specdev/.current`; treats mismatch as stale (returns null, does not delete).
- `reviewloop.js`: at invocation, after parsing flags and resolving the active assignment, write `.session-state.json` with `{assignment, reviewer, autocontinue, set_at, set_by_step}`. This is the only writer.
- `approve.js`: when the approved phase is the terminal phase (today: implementation), delete `.session-state.json` after a successful approval. For other approvals, leave the file alone.
- `focus.js`: when switching to a different assignment, clear any session-state file whose `assignment` field no longer matches the new `.specdev/.current` value.

**Verify:**
- `grep -nE "\\.session-state\\.json" src` shows writes only in `reviewloop.js` (and the helper module), and clears only in `approve.js` (terminal phase) and `focus.js`.

**Test Budget:** +1 in `tests/test-session-state-protocol.js` (new file); focused (<30s). Asserts the full protocol: write on reviewloop invocation; read+validate against `.specdev/.current`; clear on terminal approve; clear on focus-switch; stale-file ignored on cross-assignment read.

**Test Pruning:**
- None (new file, no prior tests).

**Commit:** `git commit -m "feat(session-state): add sticky reviewer/autocontinue CLI protocol"`

---

### Task 11: Emit on_satisfied continuation blocks from approve.js and reviewloop.js

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/approve.js`, `src/commands/reviewloop.js`, `src/utils/workflow-runtime.js`

**Work:**
- After a successful approval, `approve.js` looks up the gate step's `on_satisfied:` and emits a `continuation` block via `renderStepOutput`. If `.session-state.json` is present and valid, expand sticky keys (`reviewer`, `autocontinue`) into the command template; set `interrupt: false`. If no sticky state, leave templates unexpanded; set `interrupt: true`.
- `reviewloop.js` with `--autocontinue`: on a passing verdict, emit the same `continuation` block via the same helper.
- Both text and `--json` modes route through `renderStepOutput`; the JSON shape includes `{interrupt, command, sticky_keys}`.

**Verify:**
- `node bin/specdev approve brainstorm --json` in a scripted test assignment emits a `continuation` field with the expected shape.
- `grep -nE "Continuation|continuation" src/commands/approve.js src/commands/reviewloop.js` shows both paths route through `renderStepOutput`.

**Test Budget:** +0; covered by Task 17 sticky-reviewer protocol test and Task 18 integration test.

**Test Pruning:**
- None.

**Commit:** `git commit -m "feat(approve,reviewloop): emit on_satisfied continuation blocks from manifest"`

---

### Task 12: Sweep remaining hard-coded artifact-path literals

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/reviewloop.js`, `src/commands/implement.js`, `src/commands/revise.js`, `src/utils/state.js`, `src/utils/workflow-runtime.js`

**Work:**
- `reviewloop.js:31`: derive `review/...changelog*.md` + `brainstorm/design.md` references from the current phase's `requires:` plus the review-folder convention.
- `implement.js:24,26`: replace `breakdown/plan.md not found` literal with derivation from the breakdown-phase `produces:`.
- `revise.js:16,18,51`: replace hard-coded `brainstorm/design.md` references with derivation from brainstorm-phase `produces:`.
- `state.js:62,81,202,216,277` and `workflow-runtime.js:494,498`: replace `next_action` strings that name specific files with templates that pull from the manifest step's `produces:`.
- Allowlist `src/commands/migrate-legacy-assignments.js:10-12,178` — this file intentionally keeps hard-coded paths.

**Verify:**
- `grep -nE "'brainstorm/(proposal|design)\\.md'|'breakdown/plan\\.md'|'implementation/progress\\.json'" src --include='*.js' | grep -v 'migrate-legacy-assignments\\.js'` prints nothing.

**Test Budget:** +0; covered by Task 16 drift sweep.

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor: sweep hard-coded artifact-path literals to manifest-derived"`

---

### Task 13: Reduce workflow-contract.js to a derived manifest view

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/utils/workflow-contract.js`

**Work:**
- Eliminate the static `artifactPaths`, `gateFields`, `commandPhases` constants. If any caller still imports them, replace the export with a `derivedFromManifest(workflowInfo)` function (or load-time computed object) that rebuilds the same shape from `workflowInfo`.
- Document in a top-of-file comment that this module is the *only* place where derived per-phase constants may be exported, and only as a function of the manifest.

**Verify:**
- `grep -nE "^(const|module\\.exports\\.|exports\\.)\\s*(artifactPaths|gateFields|commandPhases)\\s*=" src/utils/workflow-contract.js` shows only function-style derivations, no static literals.

**Test Budget:** +0; covered by Task 16 (drift test verifies any exported value matches the manifest verbatim).

**Test Pruning:**
- None.

**Commit:** `git commit -m "refactor(workflow-contract): derive artifact/gate constants from manifest at load time"`

---

### Task 14: Collapse core SKILL.md prose to generic rendering rules

**Mode:** lightweight
**Skills:** (none — prose only)
**Files:** `.specdev/skills/core/brainstorming/SKILL.md`, `.specdev/skills/core/implementing/SKILL.md`, `.specdev/skills/core/reviewloop/SKILL.md`, `.specdev/skills/core/continue/SKILL.md`, `templates/.specdev/skills/core/brainstorming/SKILL.md`, `templates/.specdev/skills/core/implementing/SKILL.md`, `templates/.specdev/skills/core/reviewloop/SKILL.md`, `templates/.specdev/skills/core/continue/SKILL.md`

**Work:**
- Remove every enumerated choice label, reviewer-carry instruction, and post-gate continuation command string from these eight files.
- Replace with two generic rules:
  1. *"After any command that prints an `interaction` block, render it via `AskUserQuestion` (Claude Code) or its host equivalent, using the exact labels and order. Do not paraphrase, reorder, or drop options. If a chosen option has `requires_reviewer: true`, render the `follow_up` block as a second prompt."*
  2. *"After any command that prints a `continuation` block with `interrupt: false`, invoke the printed command immediately. Do not summarize, paraphrase, or ask the user. If `interrupt: true`, present the continuation alongside the `interaction` block as one combined prompt."*

**Verify:**
- Text-only scan: `grep -nE "Automated review|--autocontinue|Manual review|Skip review and approve|reviewer=<name>" .specdev/skills/core/ templates/.specdev/skills/core/ -r` prints nothing.

**Test Budget:** +0; text-only.

**Test Pruning:**
- None.

**Commit:** `git commit -m "docs(skills): collapse core SKILL.md prose to generic interaction/continuation rules"`

---

### Task 15: Update generated command-skill templates in init.js and refresh host mirrors

**Mode:** lightweight
**Skills:** (none — prose only)
**Files:** `src/commands/init.js`, `.codex/skills/specdev-reviewloop/SKILL.md`, `.codex/skills/specdev-continue/SKILL.md`, `.codex/skills/specdev-check-review/SKILL.md`, `.codex/skills/specdev-assignment/SKILL.md`, `.codex/skills/specdev-rewind/SKILL.md`, `.claude/skills/specdev-reviewloop/SKILL.md`, `.claude/skills/specdev-continue/SKILL.md`, `.claude/skills/specdev-check-review/SKILL.md`, `.claude/skills/specdev-assignment/SKILL.md`, `.claude/skills/specdev-rewind/SKILL.md`

**Work:**
- In `init.js`, rewrite the `specdev-reviewloop` template (lines 194-240), `specdev-continue`, `specdev-check-review`, and any other template that prescribes phase-specific commands or option lists. Replace embedded choice prose, reviewer-carry instruction (line 222), and autocontinue contract (lines 203-205, 216-224) with the same two generic rules from Task 14.
- Re-run `node bin/specdev update` against this repo to refresh `.codex/skills/specdev-*/SKILL.md` and `.claude/skills/specdev-*/SKILL.md` mirrors.

**Verify:**
- `grep -nE "Automated review|--autocontinue|Manual review|Skip review and approve|reviewer=<name>" src/commands/init.js .codex/skills .claude/skills -r` prints nothing.

**Test Budget:** +0; text-only.

**Test Pruning:**
- None.

**Commit:** `git commit -m "docs(init,host-skills): make generated specdev-* skill templates manifest-generic"`

---

### Task 16: Expand workflow-contract drift test with four assertion classes

**Mode:** standard
**Skills:** test-driven-development
**Files:** `tests/test-workflow-contract-drift.js`

**Work:**
- Add four assertion classes to the existing drift test (single new test entry covering all four classes):
  1. Every `kind: command` checkpoint step has an `interaction:` with the expected canonical choice ids; every gate has `on_satisfied:`; every step has `requires:` and/or `produces:`.
  2. Core SKILL.md files (`brainstorming`, `implementing`, `reviewloop`, `continue` — both `.specdev/skills/core/` and `templates/.specdev/skills/core/`) contain neither hard-coded choice labels nor hard-coded continuation commands.
  3. Generated command-skill templates in `src/commands/init.js` and installed mirrors at `.codex/skills/specdev-*/SKILL.md` and `.claude/skills/specdev-*/SKILL.md` contain neither hard-coded reviewloop choice labels, reviewer-carry instructions, nor post-gate continuation command strings.
  4. Repo-wide hard-coded artifact-path sweep: no JS file outside `src/utils/workflow-contract.js` (derived-view module) and `src/commands/migrate-legacy-assignments.js` (allowlisted) and test helpers may contain literal `brainstorm/proposal.md`, `brainstorm/design.md`, `breakdown/plan.md`, or `implementation/progress.json` strings, nor `artifactPaths.<phase>.<name>` / `gateFields.<phase>` / `commandPhases.<*>` member accesses.

**Verify:**
- `node tests/test-workflow-contract-drift.js` exits 0 against the migrated codebase.

**Test Budget:** +1 in `tests/test-workflow-contract-drift.js`; focused (<30s). Single test entry covering all four assertion classes (justification: one test = one drift contract; splitting would dilute the gate).

**Test Pruning:**
- Inspect the existing test file for any assertion now subsumed by the new sweep (e.g., narrower per-constant drift checks). Delete duplicates.

**Commit:** `git commit -m "test(drift): expand workflow-contract drift test with four manifest-as-truth assertions"`

---

### Task 17: Add sticky-reviewer protocol test

**Mode:** standard
**Skills:** test-driven-development
**Files:** `tests/test-session-state-protocol.js` (created in Task 10) — extend, do NOT create a second file

**Work:**
- Extend the file created in Task 10 with the end-to-end protocol scenarios from design.md §Testing approach:
  - Autocontinue path: `reviewloop brainstorm --reviewer=codex --autocontinue` writes `.session-state.json` → brainstorm approval reads sticky state and emits `interrupt: false` continuation with the sticky reviewer expanded → terminal `approve implementation` deletes the file.
  - Skip-review path: `approve brainstorm` with no prior session-state emits `interrupt: true` continuation, no file written.
  - Cross-assignment safety: switching `.specdev/.current` to a different assignment causes a stale session-state read to be ignored.

**Verify:**
- `node tests/test-session-state-protocol.js` exits 0.

**Test Budget:** +1 in `tests/test-session-state-protocol.js`; focused (<30s). Single new test entry covering all three scenarios as branches of one protocol test (justification: testing one protocol; three branches share setup).

**Test Pruning:**
- None.

**Commit:** `git commit -m "test(session-state): add sticky-reviewer protocol scenarios"`

---

### Task 18: Add manifest-as-truth mutated-manifest integration test

**Mode:** standard
**Skills:** test-driven-development
**Files:** `tests/test-manifest-as-truth.js` (new file)

**Work:**
- New integration test: copy the production `workflow.yaml` to a temp manifest, mutate it (add an extra required artifact to a phase; rename a gate field), point a test assignment at the mutated manifest, and verify the change is reflected end-to-end through:
  - `specdev next --json` — `next_action` and blockers track the mutated `requires:`.
  - `specdev continue` — `currentPhase` and blockers track the mutation.
  - `specdev status --json` — full `gates` and `artifacts` payload tracks the mutated manifest (not just the inferred phase string).
  - `specdev check-review` — phase inference uses the structured `detected.phase`.
  - `specdev review <phase> --round <n>` — printed artifact list tracks the manifest.
- This single test guards every consumer migrated in Tasks 3-13.

**Verify:**
- `node tests/test-manifest-as-truth.js` exits 0.

**Test Budget:** +1 in `tests/test-manifest-as-truth.js`; focused (<30s) or up to focused (<60s) if multi-CLI orchestration runs slow — justification: this single test replaces what would otherwise be 5+ per-consumer narrow tests; it is the load-bearing structural gate for the entire refactor.

**Test Pruning:**
- Inspect existing tests for any per-consumer narrow assertions on artifact/gate inference now subsumed by this end-to-end test. Delete duplicates.

**Commit:** `git commit -m "test(manifest-as-truth): mutate workflow.yaml and verify end-to-end consumer parity"`

---

### Task 19: Teach `specdev update` to migrate v1 manifests to v2

**Mode:** standard
**Skills:** test-driven-development
**Files:** `src/commands/update.js` (the file that runs on `specdev update`), `templates/.specdev/workflow.yaml` (reference for defaults)

**Work:**
- During `specdev update`, detect if the installed `.specdev/workflow.yaml` has `workflow_contract_version: 1` (or missing). If so, run a migration that adds the new fields with defaults derived from current behavior:
  - For each existing `kind: command` step that today emits choices, inject the `interaction:` block matching the canonical schema from design.md §Layer 1 (using phase-name template substitution).
  - For each existing `kind: gate` step, inject `on_satisfied:` with `next.kind: workflow_advance`, `sticky: [reviewer, autocontinue]`, `interrupt: false`.
  - For every step, ensure `produces:` (already present on guides) and add `requires:` to checkpoint and gate steps based on the prior step's `produces:`.
  - Add the top-level `interactions:` section with `discussion_checkpoint` if missing.
  - Bump `workflow_contract_version` to 2 only after all injections succeed.
- The migration is idempotent: running `specdev update` on an already-v2 manifest is a no-op.
- If the user has hand-edited their manifest in a way that conflicts (e.g., already has an `interaction:` block with non-canonical labels), emit a clear warning and skip that specific injection rather than overwriting; instruct the user to run `specdev update --force` to overwrite or reconcile manually.

**Verify:**
- Create a temp directory with a v1 `workflow.yaml` (the current shape); run `specdev update --target=<tempdir>`; inspect resulting manifest has `workflow_contract_version: 2`, `interaction:` blocks on both `review` steps, `on_satisfied:` on both `approval` gates, and top-level `interactions:` with `discussion_checkpoint`.
- Re-running `specdev update --target=<tempdir>` on the now-v2 manifest leaves the file byte-identical (idempotency).

**Test Budget:** +0; the migration's correctness is covered by Task 18's mutated-manifest integration test (which uses a freshly-migrated manifest) and by the manual verify steps above.

**Test Pruning:**
- None.

**Commit:** `git commit -m "feat(update): migrate v1 workflow.yaml to v2 manifest contract during specdev update"`

---

## Final Verification

After all tasks land:

- `node tests/test-workflow-contract-drift.js && node tests/test-session-state-protocol.js && node tests/test-manifest-as-truth.js && node tests/test-checkpoints.js` all exit 0.
- Update `package.json` `releaseDate` to today before the final commit (per repo CLAUDE.md).
