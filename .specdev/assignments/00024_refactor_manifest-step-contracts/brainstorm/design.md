# Manifest Step Contracts — Design

## Overview

SpecDev's `workflow.yaml` already encodes phases and steps as data, but three parts of each step's contract still live outside the manifest:

1. **Human-input choices.** Checkpoint steps emit choice prompts via `buildReviewChoices()` in `src/utils/workflow-runtime.js:232` and prose in `src/commands/checkpoint.js:150`, with parallel wording in skill files. Three sources of truth drift apart — root cause of the missing/paraphrased choice-prompt bug class.
2. **Artifact contracts.** Guide steps declare `produces:` (already there), but checkpoint steps hard-code their required artifacts in `checkpoint.js`, and no step declares what it `reads`. Reviewers and drift tests have no structural contract to compare against.
3. **Post-gate continuation.** What the agent should do after `specdev approve <phase>` lives only in skill prose. Agents read the rule inconsistently and stop "randomly" after gates instead of progressing.

This refactor pushes all three into the manifest. Each step that needs human input carries an `interaction:` block; each step declares its full artifact contract (`produces:` + new `requires:`); each gate carries an `on_satisfied:` continuation contract. The runtime becomes a thin renderer over the manifest; skill prose collapses to a small set of generic rendering rules.

The architectural lesson borrowed from LangGraph is **interrupts and state contracts are first-class graph data, not node code.** SpecDev remains a stateless CLI that the host agent (Claude Code / Codex) calls between turns — no LangGraph runtime adoption, no in-process graph execution.

## Non-Goals

- **Adopting LangGraph the runtime.** No in-process graph execution, streaming, reducers, multi-agent orchestration. SpecDev stays a stateless CLI called between agent turns.
- **Subworkflow primitive (LangGraph lesson #3).** Discussions and reviewloops remain special-cased. First-class sub-workflow modeling is a natural follow-up but out of scope.
- **Fully declarative conditional transitions (LangGraph lesson #4 in full).** This refactor adds `on_satisfied:` to gates only. Generalized conditional edges (predicate-based routing on arbitrary state) stay procedural in `computeNextAction`.
- **Pluggable checkpointer abstraction.** Git + filesystem + `specdev rewind` remain the persistence layer.
- **JSON-schema validation of artifact contents.** This refactor models file presence (`produces:` / `requires:`). Validating that `progress.json` has a valid `tasks[]` shape, etc., stays in command-specific code.
- **Changing the skill-execution model.** Skills remain prose guides the agent reads; this refactor only removes choice/artifact/continuation contract content from skill prose.
- **Multi-host abstraction layer for `AskUserQuestion`.** The manifest uses a host-neutral `render_via: choice_prompt` literal; each host's skill prose maps it to its tool (Claude Code: `AskUserQuestion`; Codex: equivalent). Building a generic host-abstraction layer is out of scope.

## Design

Three coordinated manifest contracts. All follow the same pattern: data in `workflow.yaml`, runtime is a thin renderer, skill prose stops carrying contract content. One new helper (`renderStepOutput`) consolidates text and JSON rendering for all three so the two surfaces cannot drift.

### Layer 1 — `interaction:` block on steps that need human input

Each checkpoint (or any step requiring a decision) declares its choice schema in the manifest:

```yaml
- id: review
  kind: command
  run: specdev checkpoint {phase}
  interaction:
    id: "{phase}_review_decision"
    kind: choice
    prompt: "How do you want to proceed from {phase}?"
    render_via: choice_prompt          # host-neutral literal; skills map to AskUserQuestion etc.
    choices:
      - id: reviewloop_autocontinue
        label: "Automated review, then continue if approved"
        command_template: "specdev reviewloop {phase} --reviewer=<name> --autocontinue"
        requires_reviewer: true
        autocontinue: true
      - id: reviewloop_only
        label: "Automated review only"
        command_template: "specdev reviewloop {phase} --reviewer=<name>"
        requires_reviewer: true
      - id: manual_review
        label: "Manual review"
        command_template: "specdev review {phase}"
      - id: approve_skip_review
        label: "Skip review and approve"
        command_template: "specdev approve {phase}"
    follow_up:
      when: "choice.requires_reviewer"
      id: reviewer_pick
      kind: choice
      prompt: "Which reviewer?"
      source: reviewers_listing        # runtime expands to one option per .specdev/skills/core/reviewloop/reviewers/*
```

`buildReviewChoices()` becomes a template-substitution helper over the manifest entries (substituting `{phase}`, `{discussion}`, expanding `source: reviewers_listing`). `checkpoint.js` text and `--json` outputs both render from the same source, so labels are byte-identical.

**Discussion checkpoint coverage.** `specdev checkpoint discussion --discussion=<id>` is an existing checkpoint surface with its own 2-choice schema (`Automated review` + `Manual review`, no autocontinue/skip-approve options). It lives outside the assignment `phases:` tree, but the same drift problem applies: today `buildReviewChoices()` has a `discussion` branch at `src/utils/workflow-runtime.js:236-252` and `src/commands/checkpoint.js:31` branches on `phase === 'discussion'`. To prevent leaving this as the one remaining hard-coded contract, add a top-level `interactions:` section to `workflow.yaml` (sibling to `phases:` and `hooks:`) for non-phase interaction blocks:

```yaml
interactions:
  - id: discussion_checkpoint
    kind: choice
    prompt: "How do you want to review this discussion?"
    render_via: choice_prompt
    choices:
      - id: reviewloop
        label: "Automated review"
        command_template: "specdev reviewloop discussion --discussion={discussion} --reviewer=<name>"
        requires_reviewer: true
      - id: manual_review
        label: "Manual review"
        command_template: "specdev review discussion --discussion={discussion}"
    follow_up:
      when: "choice.requires_reviewer"
      id: reviewer_pick
      kind: choice
      prompt: "Which reviewer?"
      source: reviewers_listing
```

`buildReviewChoices(phase, { discussion })` resolves to the `interactions.discussion_checkpoint` entry when `discussion` is set; otherwise it resolves to the active phase step's `interaction:` block. The `discussion` JS branch in `checkpoint.js:31` stays (it's a different artifact-validation path), but its choice-rendering goes through the same `renderStepOutput` helper. Discussion drift test asserts the manifest entry produces the existing 2-choice schema byte-identical to today's output.

Sub-workflow modeling for discussions as full first-class entities (their own phase tree, gates, etc.) remains out of scope — Non-Goals item.

Skill prose at `.specdev/skills/core/brainstorming/SKILL.md` and `.specdev/skills/core/implementing/SKILL.md` collapses to a single rule:

> After any command that prints an `interaction` block, render it via `AskUserQuestion` (Claude Code) or its host equivalent, using the exact labels and order. Do not paraphrase, reorder, or drop options. If a chosen option has `requires_reviewer: true`, render the `follow_up` block as a second prompt.

### Layer 2 — `requires:` + `produces:` artifact contract

Extend the existing `produces:` on guide steps; add `requires:` on checkpoint and approval steps:

```yaml
phases:
  brainstorm:
    steps:
      - id: create_artifacts
        kind: guide
        produces:
          - path: brainstorm/proposal.md
            required: true
          - path: brainstorm/design.md
            required: true
      - id: review
        kind: command
        run: specdev checkpoint brainstorm
        requires:
          - path: brainstorm/proposal.md
          - path: brainstorm/design.md
      - id: approval
        kind: gate
        gate: brainstorm_approved
        requires:
          - path: brainstorm/proposal.md
          - path: brainstorm/design.md
```

`computeNextAction` derives "missing artifacts" blockers from the upcoming step's `requires:`. `checkpoint.js` removes its hard-coded artifact lists (currently `src/commands/checkpoint.js:100-115` for brainstorm, `:175-195` for implementation) and reads them from the manifest. The same helper computes the blocker list for both `--json` and text output.

**Critical: the manifest-as-truth contract also covers `state.js` and `approve-phase.js`.** Today two upstream modules encode the artifact-and-gate contract via static constants, and they run *before* `computeNextAction` can render a manifest step:

- `src/utils/state.js` — `detectAssignmentState()` (lines 29-139) hard-codes per-phase artifact paths at lines 31-35 via `artifactPaths.brainstorm.proposal`, `…design`, `breakdown.plan`, `implementation.progress`, and hard-codes gate-field lookups at lines 68 and 115 via `gateFields.brainstorm` / `gateFields.implementation`. This is the function that decides which phase is "in progress" vs "checkpoint ready" — if it stays hard-coded, the manifest can declare different `requires:` and the state machine will not honor it.
- `src/utils/approve-phase.js` — `approveBrainstorm()` (line 25) and `approveImplementation()` (line 49) hard-code which artifacts must exist before flipping the gate; they also write directly to `gateFields.<phase>`.

Both modules must be migrated to read from the manifest. Concretely:

- `detectAssignmentState()` receives the loaded `workflowInfo` and walks the active assignment's phase steps in declared order. For each step it checks `requires:` (artifacts that must exist for this step to be entered) and the step's gate (`kind: gate`, `gate: <field>`) instead of hard-coded `gateFields[phase]`. **The return shape becomes a structured state contract, not just a state name string:**

  ```js
  {
    phase: 'brainstorm' | 'breakdown' | 'implementation' | null,
    stepId: string,         // e.g. 'create_artifacts', 'review', 'approval'
    stepKind: 'guide' | 'command' | 'gate' | null,
    status: 'in_progress' | 'checkpoint_ready' | 'approved' | 'completed' | 'blocked',
    completedPhases: ['brainstorm', ...],   // phases whose gate is satisfied
    gate: string | null,    // the gate field declared on the active step, if any
    state: string,          // legacy state-name string ('brainstorm_in_progress', etc.), derived from the structured fields above for back-compat — readers MUST NOT branch on this; new code reads phase/stepId/status
    blockers: [...],
    progress: {...}
  }
  ```

  The legacy state-name string remains for one release as a derived field so external consumers (e.g., `specdev status --json` payloads parsed by anyone) keep working, but every internal reader switches to the structured fields. The string is removed in a follow-up cleanup once the structured contract has stabilized.

- **Every string-based state consumer migrates in lockstep with the signature change.** Consumers currently parsing legacy state strings or prefixes:
  - `src/utils/workflow-runtime.js` — `hookOutcomesForState`, `interactionForDetectedState`, `actionForDetectedState`, `buildTrace` all branch on state-name strings. Migrate to read `phase`/`stepId`/`stepKind`/`status` directly. The `interaction` block resolved per state comes from the manifest step's `interaction:` (Layer 1 already covers this); these renderers become thin lookups by `(phase, stepId)`.
  - `src/commands/continue.js` — `currentPhase = detected.state.startsWith('brainstorm') ? 'brainstorm' : 'implementation'` (used for review-feedback path resolution) → `currentPhase = detected.phase`.
  - `src/commands/context.js` — prefix-derived phase resolution → `detected.phase` directly.
  - `src/commands/check-review.js` — "anything not brainstorm becomes implementation" → `detected.phase` directly; reject `null` explicitly.
  The mutated-manifest integration test asserts that `specdev next`, `continue`, `context`, and `check-review` all infer phase, interaction block, hook outcomes, and review-feedback paths from the structured state (verified by, e.g., adding a synthetic intermediate phase to the test manifest and observing `detected.phase` flow through to the correct review-feedback file path).
- **`detectAssignmentState` has six callers — all must be migrated together, not just `computeNextAction`.** Confirmed call sites: `src/commands/continue.js:34`, `src/commands/context.js:94` and `:180`, `src/commands/check-review.js:30`, `src/utils/working-memory.js:70` and `:81`, plus `src/utils/workflow-runtime.js:327`. If only `computeNextAction` is migrated and the others keep the old two-argument signature, the runtime keeps a hidden fallback to the static `artifactPaths`/`gateFields` constants for `continue`, `context`, `check-review` phase inference, and working-memory summaries. The manifest-as-truth contract would silently fail on those surfaces (e.g., `specdev continue` could report the wrong phase, `check-review` could read the wrong feedback file, working-memory could omit completed assignments). To prevent this, the migration introduces a single loader helper used by every caller:

  ```js
  // src/utils/state.js (new top-level helper)
  export async function loadStateForAssignment(specdevPath, assignmentSummary, assignmentPath) {
    const workflowInfo = await loadWorkflowDefinition(specdevPath)  // already exists
    const detected = await detectAssignmentState(assignmentSummary, assignmentPath, workflowInfo)
    return { workflowInfo, detected }
  }
  ```

  All six existing callers switch to `loadStateForAssignment` (or call `loadWorkflowDefinition` themselves and pass `workflowInfo` through). The old `detectAssignmentState(summary, path)` two-argument form is removed; the function only accepts `(summary, path, workflowInfo)`. No compatibility fallback. The drift/integration test mutates a test manifest and verifies the change is reflected through at least `specdev next`, `specdev continue`, `specdev status`, and `specdev check-review` phase inference.
- `approvePhase()` looks up the gate step for the named phase, reads its `requires:` block, validates artifact presence, then writes the gate field declared on that step. No per-phase branching (`approveBrainstorm`/`approveImplementation` collapse to one function parameterized by manifest data).
- `src/utils/workflow-contract.js`'s `artifactPaths` and `gateFields` constants are either eliminated (callers read from the manifest) or downgraded to a load-time *derived* view of the manifest, so they cannot drift from `workflow.yaml`. Drift test asserts that any constant exported here matches the manifest verbatim.

This makes "manifest-as-truth" structurally hold: changing `requires:` or a gate field in `workflow.yaml` immediately changes the behavior of `checkpoint`, `approve`, `next`, and state detection. None of them can advance or block based on stale JS constants.

Out of scope: validating artifact *content* (e.g., `progress.json` `tasks[]` shape) — that stays in command code for now and may be modeled later via a `schema:` reference field. Note: `approvePhase` already enforces `tasks[]` completeness for implementation; that content check stays, only the file-presence and gate-field lookup parts migrate.

### Layer 3 — `on_satisfied:` continuation contract on gates

Every gate (and every approval-emitting command) carries a typed continuation block:

```yaml
- id: approval
  kind: gate
  gate: brainstorm_approved
  on_satisfied:
    next:
      kind: workflow_advance      # tells agent to call specdev next --json and execute next_action
      sticky:                     # keys carried forward from session-state
        - reviewer
        - autocontinue
      interrupt: false            # do NOT prompt the user; proceed immediately
```

`specdev approve <phase>` and `specdev reviewloop <phase> --autocontinue` emit a typed `continuation` block in their output (text and JSON), driven by the gate's `on_satisfied:`. The block tells the agent: *"the next thing for you to do is `<command>`; do not prompt the user."*

**Sticky-state via `.specdev/.session-state.json`** — A small JSON file persists across CLI invocations within an assignment:

```json
{
  "assignment": "00024_refactor_manifest-step-contracts",
  "reviewer": "codex",
  "autocontinue": true,
  "set_at": "2026-05-12T...",
  "set_by_step": "brainstorm.review"
}
```

**Concrete CLI write/update/clear protocol** (assigning each operation to a specific command):

- **Write (and update):** `specdev reviewloop <phase> --reviewer=<name> --autocontinue` is the *only* command that writes or updates `.session-state.json`. It does so on invocation, after parsing flags and resolving the active assignment from `.specdev/.current`. The file's `assignment` field is set to that assignment's folder name; `reviewer` and `autocontinue` come from flags; `set_at` is the current ISO timestamp; `set_by_step` records the manifest step id that triggered the write. Re-invocation in a later phase (e.g., `specdev reviewloop implementation --reviewer=codex --autocontinue` chained from brainstorm) overwrites the same file with the new `set_by_step` and refreshed `set_at`. No other command writes the file.
- **Read:** `specdev approve <phase>`, `specdev reviewloop <phase>` (any invocation), and `specdev next --json` read `.session-state.json` if present. Every read validates that `state.assignment === <current assignment from .specdev/.current>`. On mismatch the file is treated as stale and ignored (not deleted — `specdev focus <id>` is the only thing that can change `.current`, and the stale file will be overwritten when the new assignment first triggers a write).
- **Clear:** Cleared by `specdev approve <terminal-phase>` (today: `specdev approve implementation`) at the point the assignment becomes complete; the file is deleted on a successful terminal-phase approval. Also cleared when `specdev focus <id>` switches to a different assignment (the focus command unlinks any session-state file whose `assignment` field no longer matches). No standalone `specdev session reset` command is added in this refactor.
- **Ownership safety:** Because every read validates against `.specdev/.current`, a stale file left over from a previous assignment never expands into a continuation for the wrong assignment. The worst-case behavior is "no sticky reviewer found → fall back to user prompt," which is safe.

**Continuation expansion when no sticky reviewer exists** (covers the skip-review path and first-time gates):

- `specdev approve brainstorm` invoked directly by the user (skip-review path, no prior reviewloop, no `.session-state.json`) emits a continuation block with `interrupt: true` and an unexpanded template:
  ```
  Continuation (user input required):
    Pick a reviewer for implementation:
      specdev reviewloop implementation --reviewer=<name> --autocontinue
    Or skip review:
      specdev approve implementation
  ```
  Skill prose for the host agent renders this via `AskUserQuestion` (the same `interaction:` mechanism from Layer 1, reused for continuation prompts when `interrupt: true`).
- `specdev approve brainstorm` invoked from inside the autocontinue reviewloop flow (with `.session-state.json` present and valid) emits the sticky form with `interrupt: false`:
  ```
  Continuation (no user prompt required):
    specdev reviewloop implementation --reviewer=codex --autocontinue
  ```

Result: after the user picks `reviewloop_autocontinue` + `codex` at brainstorm and the brainstorm reviewloop approves, the sticky file exists; `specdev approve brainstorm` emits the sticky form and the agent advances without prompting. If the user instead picks "Skip review and approve" at brainstorm, no sticky file is written, and the agent prompts the user for a reviewer choice at the implementation gate — preserving today's behavior for that path.

Skill prose at `specdev-continue`, `brainstorming`, `implementing`, and `reviewloop` adopts a single rule:

> After any command that prints a `continuation` block with `interrupt: false`, invoke the printed command immediately. Do not summarize, paraphrase, or ask the user. If `interrupt: true`, present the continuation alongside the `interaction` block as one combined prompt.

### Rendering consolidation

A new helper `renderStepOutput(step, runtimeContext)` in `src/utils/workflow-runtime.js` knows how to emit:

- `interaction` blocks (substituting templates, expanding `source:` references, picking text vs. JSON shape)
- `continuation` blocks (substituting templates from sticky-state, picking text vs. JSON shape)
- artifact validation blockers (from `requires:` / `produces:`)

`checkpoint.js`, `approve.js`, `reviewloop.js`, and the `--json` paths of each all funnel through this helper. The current divergence between text mode and JSON mode (different labels, different field shapes) goes away by construction.

### Migration path

Two-phase landing inside this assignment:

1. **Data first.** Add `interaction:`, `requires:`, `on_satisfied:` to `templates/.specdev/workflow.yaml` and `.specdev/workflow.yaml`. Bump `workflow_contract_version` to 2. Update the validator (`loadWorkflowDefinition`) to accept the new fields and to require them on the relevant step kinds. Old fields (`produces:` already there) stay.
2. **Consumers second.** Land `renderStepOutput`, then migrate all manifest-contract consumers:
   - `src/commands/checkpoint.js` — remove hard-coded artifact lists and hard-coded choice prose; render from manifest.
   - `src/commands/approve.js` and `src/utils/approve-phase.js` — collapse `approveBrainstorm`/`approveImplementation` into one function that reads the named phase's gate step from the manifest (`requires:` for artifacts, `gate:` for the field to flip).
   - `src/commands/reviewloop.js` — emit `continuation` blocks from gate `on_satisfied:` rather than ad-hoc strings.
   - `src/commands/review.js` — `printReviewArtifacts()` (lines 71-79) and the implementation-review artifact list at lines 188-206 read `artifactPaths.brainstorm.proposal` / `.design` (and string-literal `brainstorm/design.md`, `breakdown/plan.md`) directly. Migrate to derive the review artifact list from the active phase's `requires:` (and the prior phase's `produces:` when reviewing implementation needs to also show design/plan context). Discussion review continues to use its existing brainstorm-artifact mapping, routed through the same helper.
   - `src/utils/state.js` — `detectAssignmentState` becomes 3-argument `(summary, path, workflowInfo)`; walks manifest phase steps in order; derives state name + blockers from each step's `requires:` and gate fields, not from `artifactPaths`/`gateFields` constants. Add a new `loadStateForAssignment(specdevPath, summary, path)` helper that loads workflow once and returns `{ workflowInfo, detected }` for callers that don't already have `workflowInfo`.
   - **Every `detectAssignmentState` caller migrates in lockstep** — `src/commands/continue.js:34`, `src/commands/context.js:94` and `:180`, `src/commands/check-review.js:30`, `src/utils/working-memory.js:70` and `:81`, `src/utils/workflow-runtime.js:327`. Switch each to `loadStateForAssignment` (or load workflow + pass through). The old two-argument form is removed; no compatibility shim.
   - `src/utils/workflow-runtime.js` (`computeNextAction`) — uses `loadStateForAssignment`; derives `next_action` text from the manifest step's `next_action` field (if added) or from a default template per step kind.
   - `src/utils/workflow-contract.js` — either eliminate `artifactPaths` / `gateFields` / `commandPhases` constants or rebuild them at load time from the manifest as a derived view; drift test enforces parity.
   - **`src/commands/continue.js` workflow-status path** — `collectWorkflowStatus()` (lines 203-223) reads `workflowArtifactPaths.brainstorm.proposal` / `.design`, `workflowArtifactPaths.breakdown.plan`, `workflowArtifactPaths.implementation.progress` directly, and calls `readGateStatus()` which is itself hard-coded. Both must be migrated together: `collectWorkflowStatus()` enumerates artifacts from the active manifest's `produces:`/`requires:` blocks across all phases; `readGateStatus()` enumerates fields from all manifest steps with `kind: gate`. Without this, `specdev status --json` and `specdev continue` report stale `gates` and `artifacts` payloads even after the state machine is migrated. The mutated-manifest integration test asserts the `status --json` *payload* (not just the inferred phase string) tracks the manifest.
   - Skill prose at `.specdev/skills/core/brainstorming/SKILL.md`, `…implementing/SKILL.md`, `…reviewloop/SKILL.md`, `…continue/SKILL.md` — collapse to generic rendering rules.
   - **Generated command-skill templates in `src/commands/init.js`** — the `specdev-reviewloop` template (lines 194-240) and the host-specific skill installs into `.codex/skills/specdev-reviewloop/SKILL.md` and `.claude/skills/specdev-reviewloop/SKILL.md` currently embed the hard-coded autocontinue contract (lines 203-205, 216-224) and reviewer-carry instruction (line 222). Migrate the templates to the same generic rule: *"render runtime `interaction` and `continuation` blocks exactly; do not paraphrase."* Otherwise `specdev init` and `specdev update` reinstall stale prose that bypasses the new `continuation` block, re-introducing the "stops after approval" and reviewer-carry drift in the exact host-facing skills agents actually read. The same generic rewrite applies to `specdev-continue`, `specdev-check-review`, and any other init.js template that prescribes phase-specific commands or option lists.
   - **Remaining hard-coded artifact-path string literals across `src/`** — sweep and migrate or generalize:
     - `src/commands/reviewloop.js:31` — `Read ${name}/review/brainstorm-changelog*.md and ${name}/brainstorm/design.md` → derive from the current phase's `requires:` + the review folder convention.
     - `src/commands/implement.js:24,26` — `breakdown/plan.md not found` → derive from manifest's breakdown-phase `produces:`.
     - `src/commands/revise.js:16,18,51` — hard-coded `brainstorm/design.md` references → derive from brainstorm-phase `produces:`.
     - `src/utils/state.js:62,81,202,216,277` and `src/utils/workflow-runtime.js:494,498` — `next_action` strings naming specific files (`brainstorm/proposal.md + brainstorm/design.md`, `breakdown/plan.md`, `implementation/progress.json`) → derive from the manifest step's `produces:` so renaming an artifact updates user-facing prompts automatically.
   - **Explicit exclusions** — `src/commands/migrate-legacy-assignments.js:10-12,178` keeps its hard-coded artifact paths intentionally; it is the legacy-layout migration command and its purpose is to move files into the *current* phase-folder layout that the manifest then validates. Drift test allowlists this file.
   Drift tests gate the migration.

`specdev update` will run a manifest migration on existing installs (adds new fields with defaults derived from current behavior).

### Testing approach

- Extend `tests/test-workflow-contract-drift.js` to assert:
  - Every checkpoint step has `interaction` with the expected canonical choice ids; every step has `requires:` and/or `produces:`; every gate has `on_satisfied:`.
  - Core SKILL.md files (`.specdev/skills/core/brainstorming/SKILL.md`, `…implementing/SKILL.md`, `…reviewloop/SKILL.md`, `…continue/SKILL.md`) contain neither hard-coded choice labels nor hard-coded continuation commands.
  - **Generated command-skill templates in `src/commands/init.js`** (entries for `specdev-reviewloop`, `specdev-continue`, `specdev-check-review`, etc.) contain neither hard-coded reviewloop choice labels (`Automated review`, `--autocontinue`, `Manual review`, `Skip review`), reviewer-carry instructions, nor post-gate continuation command strings. Same scan applies to the installed `.codex/skills/specdev-*/SKILL.md` and `.claude/skills/specdev-*/SKILL.md` mirrors.
  - **Repo-wide hard-coded artifact-path sweep** — no JS file outside `src/utils/workflow-contract.js` (the derived-view module), `src/commands/migrate-legacy-assignments.js` (allowlisted), and test helpers may contain literal `brainstorm/proposal.md`, `brainstorm/design.md`, `breakdown/plan.md`, or `implementation/progress.json` strings or `artifactPaths.<phase>.<name>` member accesses. Same scan for `gateFields.<phase>` and `commandPhases.<*>` outside the derived-view module.
- Add `tests/test-checkpoints.js` cases that snapshot text and JSON output for both `specdev checkpoint brainstorm` and `specdev checkpoint implementation`, asserting byte-identical labels.
- Add a sticky-reviewer integration test: simulate picking `reviewloop_autocontinue` + reviewer at brainstorm, verify `.session-state.json` is written, verify `specdev approve brainstorm` emits a `continuation` block with the sticky reviewer.
- Add a **manifest-as-truth integration test**: mutate a test `workflow.yaml` (e.g., add an extra required artifact, rename a gate field) and verify the change is reflected end-to-end through `specdev next`, `specdev continue`, `specdev status` (asserting the full `gates` and `artifacts` payload, not just the inferred phase string), `specdev check-review` phase inference, and `specdev review <phase> --round <n>` (asserting the printed artifact list tracks the manifest). This catches any consumer that quietly retained a hard-coded fallback in the state-detection, workflow-status, or review-instruction surface.
- Add a **sticky-reviewer protocol test**: simulate the full autocontinue path (`reviewloop brainstorm --reviewer=codex --autocontinue` writes session-state → brainstorm approval → `approve brainstorm` reads sticky state and emits non-interrupt continuation → `approve implementation` deletes session-state). Also test the skip-review path (`approve brainstorm` with no prior session-state emits interrupt-true continuation, no file written). Also test the cross-assignment safety: `.specdev/.current` switches assignment, stale session-state is ignored on read.
- Keep the existing test footprint compact per the [[reduced-test-suite]] memory; no per-module narrow tests.

## Success Criteria

- **Manifest-as-truth:** Every checkpoint step in `workflow.yaml` declares an `interaction:` block; choice labels and ids live there, not in JS or skill prose. The `interactions:` top-level section covers non-phase checkpoint surfaces (today: `discussion_checkpoint`). `buildReviewChoices` is replaced by manifest reads or reduces to a small template helper.
- **Label parity:** `specdev checkpoint <phase>` text and `--json` outputs use byte-identical labels and ids per choice. Verified by a snapshot test.
- **Artifact contract structural:** Every step has `requires:` and/or `produces:`. `checkpoint.js`, `approve-phase.js`, and `state.js` no longer hard-code per-phase artifact lists or gate fields — all three consume the manifest. `artifactPaths`/`gateFields` in `workflow-contract.js` are eliminated or derived from the manifest at load time. Drift test asserts: (a) every step has the artifact contract; (b) no JS module exports a per-phase artifact constant that disagrees with the manifest; (c) `detectAssignmentState` and `approvePhase` source-of-truth comes from the manifest (verified by mutating a test manifest and observing both functions follow it).
- **Continuation contract structural:** Every `kind: gate` step has `on_satisfied:`. `specdev approve <phase>` and `specdev reviewloop <phase> --autocontinue` both emit a `continuation` block with the next concrete command and sticky-state expanded.
- **Sticky reviewer end-to-end:** After a user picks `reviewloop_autocontinue` + a reviewer at brainstorm, no further user prompts appear before reviewloop implementation completes. Demonstrated by a scripted transcript or integration test.
- **Skill prose minimized:** `.specdev/skills/core/brainstorming/SKILL.md`, `.../implementing/SKILL.md`, `.../reviewloop/SKILL.md`, `.../continue/SKILL.md` no longer enumerate choices or describe what to do after a gate. They point at the runtime output and mandate generic rendering rules. **The same applies to the generated command-skill templates in `src/commands/init.js` and their installed mirrors at `.codex/skills/specdev-*/SKILL.md` and `.claude/skills/specdev-*/SKILL.md`** — `specdev init` and `specdev update` install generic prose that cannot drift from the manifest.
- **Drift tests expanded:** `tests/test-workflow-contract-drift.js` covers all three contracts (interaction presence + ids, requires/produces presence, on_satisfied presence on gates). It also asserts SKILL.md files contain neither hard-coded choice labels nor hard-coded continuation commands.
- **Bug classes structurally eliminated:** Missing/paraphrased choice prompts, "stops after approval", and silent artifact-contract drift all become impossible without breaking a drift test.
- **Backward-compatible migration:** `specdev update` upgrades existing `.specdev/workflow.yaml` installs to contract version 2 with no manual editing required.

## Key Decisions

- **Manifest stays YAML, not extended.** No new schema layer; the existing `workflow_contract_version` field bumps from 1 to 2, validator extends to recognize the new fields. Reason: lowest-friction migration.
- **`render_via: choice_prompt`** is host-neutral; skill prose maps it to `AskUserQuestion` (Claude Code) or equivalent (Codex). Reason: avoid coupling the manifest to a Claude-Code-specific tool name; future hosts can add their own mapping in skill prose without manifest changes.
- **`.specdev/.session-state.json`** is a new file, not an extension of `progress.json` or the assignment folder. Reason: session state is cross-phase and ephemeral; it doesn't belong in any single phase's artifacts.
- **`on_satisfied:` on gates only**, not on every step. Reason: this refactor's continuation contract handles the gate→next-phase transition where stopping is observed; generalizing to all steps is lesson #4 in full and out of scope.
- **No artifact-content schemas yet.** `requires:` and `produces:` model file presence only. Content schemas (`schema:` field referencing JSON Schema) are a clean follow-up but not included here.

## Open Questions / Deferred

- Subworkflow primitive (LangGraph lesson #3) for unifying discussions and reviewloops — natural follow-up.
- Generalized declarative transitions (LangGraph lesson #4 in full) for arbitrary conditional edges — natural follow-up.
- Artifact-content schema validation — natural follow-up, would build on `requires:` / `produces:`.
- Host abstraction layer for `render_via:` literals — keep as skill-prose mapping for now; revisit if a third host is added.
