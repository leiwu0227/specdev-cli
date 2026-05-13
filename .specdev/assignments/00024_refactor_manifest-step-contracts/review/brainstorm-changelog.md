# Brainstorm Review Changelog

## Round 1

### F1.1 — Accepted

Reviewer correctly identified that `src/utils/state.js` (`detectAssignmentState`, lines 31-35, 68, 115) and `src/utils/approve-phase.js` (lines 25, 49) encode the artifact-and-gate contract via the static `artifactPaths` and `gateFields` constants in `src/utils/workflow-contract.js`. The original design only named `checkpoint.js`, `approve.js`, `reviewloop.js`, and `computeNextAction` as consumers of `requires:` / `produces:`, leaving the state machine and approval gate hard-coded. Under that design, `workflow.yaml` could declare different artifact contracts while `specdev next --json` and `specdev approve` still advanced or blocked based on the old JS constants — the "manifest-as-truth" success criterion would not hold.

**Revision applied:**

1. **Design § Layer 2** — Added an explicit subsection ("Critical: the manifest-as-truth contract also covers `state.js` and `approve-phase.js`") naming both modules and describing the concrete migration:
   - `detectAssignmentState()` receives `workflowInfo` and walks manifest phase steps in declared order; state name and blockers derived from each step's `requires:` + gate field, not from `artifactPaths`/`gateFields`.
   - `approvePhase()` collapses `approveBrainstorm`/`approveImplementation` into one function that reads the named phase's gate step from the manifest.
   - `artifactPaths` and `gateFields` constants in `workflow-contract.js` either eliminated or downgraded to a load-time derived view of the manifest.
2. **Design § Migration path — Consumers second** — Expanded the list to enumerate every consumer that must migrate: `checkpoint.js`, `approve.js` + `approve-phase.js`, `reviewloop.js`, `state.js`, `workflow-runtime.js`, `workflow-contract.js`, and the four skill files.
3. **Success Criteria § Artifact contract structural** — Strengthened to require that `state.js` and `approve-phase.js` (not just `checkpoint.js`) no longer hard-code per-phase artifacts or gate fields, that `artifactPaths`/`gateFields` cannot drift from the manifest, and that drift tests verify both modules follow a mutated test manifest.

The implementation-time `tasks[]` content check inside `approveImplementation` (lines 62-72) is explicitly kept — only the file-presence and gate-field lookup parts migrate. Content-schema validation remains out of scope per the existing Non-Goals section.

## Round 2

### F2.1 — Accepted

Reviewer correctly identified that the Round 1 revision only migrated `detectAssignmentState`'s `computeNextAction` call path, leaving five other callers on the old two-argument signature: `src/commands/continue.js:34`, `src/commands/context.js:94` and `:180`, `src/commands/check-review.js:30`, `src/utils/working-memory.js:70` and `:81`. Under that partial migration, `specdev continue`, `specdev status`, `specdev context`, `specdev check-review` phase inference, and working-memory summaries would silently keep using the hard-coded `artifactPaths`/`gateFields` constants — manifest-as-truth would fail on those surfaces (wrong phase reports, wrong review feedback file, omitted completed assignments).

**Revision applied:**

1. **Design § Layer 2** — Added a new bullet listing all six confirmed `detectAssignmentState` call sites and the lockstep migration requirement. Introduced a single `loadStateForAssignment(specdevPath, summary, path)` helper that loads workflow once and returns `{ workflowInfo, detected }`. The old two-argument `detectAssignmentState(summary, path)` form is removed entirely; no compatibility shim. The drift/integration test must verify a mutated test manifest is reflected through `specdev next`, `specdev continue`, `specdev status`, and `specdev check-review` phase inference.
2. **Design § Migration path — Consumers second** — Expanded the `state.js` bullet to enumerate every caller that migrates in lockstep (the six sites above) and to require removal of the old two-argument signature.
3. **Design § Testing approach** — Added an explicit "manifest-as-truth integration test" bullet that mutates a test `workflow.yaml` and verifies end-to-end propagation through `next`, `continue`, `status`, and `check-review` phase inference. This catches any consumer that quietly retained a hard-coded fallback.

No new modules are added beyond the `loadStateForAssignment` helper; existing callers just route through it instead of calling `detectAssignmentState` directly. The migration stays inside the "Consumers second" phase and does not require an additional landing step.

## Round 3

### F3.1 — Accepted

Reviewer correctly identified that `specdev continue` / `specdev status` use a second, independent workflow-status path that the Round 2 migration did not cover. `src/commands/continue.js:52` calls `collectWorkflowStatus(selected.path)`, defined at `:203-223`, which reads artifacts directly from `workflowArtifactPaths.brainstorm.proposal` / `.design`, `workflowArtifactPaths.breakdown.plan`, `workflowArtifactPaths.implementation.progress` and calls `readGateStatus()` from `src/utils/state.js:13-27` — which itself hard-codes `gateFields.brainstorm` and `gateFields.implementation`. Under the prior design, mutating a manifest gate or artifact would update `detectAssignmentState` (so `next_action` / state inference is correct) while `specdev status --json` still reported stale `gates` and `artifacts` payloads. Both surfaces must migrate together.

**Revision applied:**

1. **Design § Migration path — Consumers second** — Added an explicit bullet for `collectWorkflowStatus()` (lines 203-223) and `readGateStatus()` (state.js lines 13-27). `collectWorkflowStatus()` now enumerates artifacts from the active manifest's `produces:` / `requires:` blocks across all phases; `readGateStatus()` enumerates gate fields from all manifest steps with `kind: gate`. Also extended `workflow-contract.js` to cover `commandPhases` (in addition to `artifactPaths`/`gateFields`) since `approve.js` uses it.
2. **Design § Testing approach — manifest-as-truth integration test** — Strengthened to assert the full `status --json` payload (`gates` and `artifacts`), not just the inferred phase string. This catches any consumer that retained a hard-coded fallback in either the state-detection path or the workflow-status path.

### F3.2 — Accepted

Reviewer correctly identified that the sticky-reviewer design did not specify which CLI command writes `.specdev/.session-state.json`, how it validates assignment ownership, when it is cleared, or what continuation is emitted when no sticky reviewer exists. The pick happens in the host agent UI, not in the stateless CLI; today the first CLI invocation that knows the reviewer + autocontinue choice is `specdev reviewloop <phase> --reviewer=<name> --autocontinue` (`reviewloop.js:640-688`). The skip-review path through `specdev approve brainstorm` (`approve.js:28-63`) has no reviewer at all. Without a concrete protocol, `specdev approve brainstorm` could not reliably expand the promised continuation, breaking the "no further user prompts" success criterion in practice.

**Revision applied:**

1. **Design § Layer 3 — Concrete CLI write/update/clear protocol** — Added a new subsection assigning each operation to a specific command:
   - **Write/update:** `specdev reviewloop <phase> --reviewer=<name> --autocontinue` is the only writer; writes on invocation after resolving the active assignment from `.specdev/.current`; later phases overwrite the same file with new `set_by_step` + refreshed `set_at`.
   - **Read:** `specdev approve <phase>`, `specdev reviewloop <phase>`, `specdev next --json` read the file; every read validates `state.assignment === <current>`; mismatches are treated as stale and ignored (not deleted).
   - **Clear:** `specdev approve <terminal-phase>` (e.g., `approve implementation`) deletes the file on successful terminal-phase approval; `specdev focus <id>` unlinks any session-state file whose `assignment` no longer matches `.current`.
   - **Ownership safety:** Cross-assignment stale state cannot expand into the wrong continuation because every read validates against `.specdev/.current`; worst case falls back to user prompt.
2. **Design § Layer 3 — Continuation expansion when no sticky reviewer exists** — Added explicit behavior for the skip-review path: `specdev approve brainstorm` emits a continuation block with `interrupt: true` and an unexpanded reviewer template, which the host agent renders via `AskUserQuestion` (reusing the Layer 1 interaction mechanism). The autocontinue path emits the sticky form with `interrupt: false`.
3. **Design § Testing approach — sticky-reviewer protocol test** — Added an integration test covering the full autocontinue path, the skip-review path, and the cross-assignment safety case.

Both findings are addressed without expanding scope beyond the three layers; the new helpers (`loadStateForAssignment`, the session-state protocol) live inside the consumers-second migration phase.

---

# Fresh review cycle (after archiving Rounds 1-3 feedback to `brainstorm-feedback-rounds-1-3.md`)

## Round 1 (fresh)

### F1.1 (fresh) — Accepted

Reviewer correctly identified that `specdev checkpoint discussion --discussion=<id>` is an existing checkpoint surface with its own 2-choice schema, and the design only modeled assignment phases under `phases:` — leaving the discussion checkpoint hard-coded in `src/commands/checkpoint.js:31` and `src/utils/workflow-runtime.js:236-252`. Under the prior design, either the discussion branch stayed hard-coded (preserving drift) or the discussion prompt regressed.

**Revision applied:**

1. **Design § Layer 1 — Discussion checkpoint coverage** — Added a top-level `interactions:` section to `workflow.yaml` (sibling to `phases:` and `hooks:`) with a `discussion_checkpoint` entry that declares the existing 2-choice schema (`Automated review` + `Manual review`). `buildReviewChoices(phase, { discussion })` resolves to this entry when `discussion` is set; otherwise it resolves to the active phase step's `interaction:` block. The discussion JS branch in `checkpoint.js:31` stays for artifact validation, but its choice-rendering routes through the same `renderStepOutput` helper. Drift test asserts the manifest entry produces the existing 2-choice schema byte-identical to current output.
2. **Design § Success Criteria — Manifest-as-truth** — Extended to call out that the `interactions:` top-level section covers non-phase checkpoint surfaces (today: `discussion_checkpoint`).
3. **Non-Goals unchanged** — Full sub-workflow modeling for discussions (their own phase tree, gates, etc.) remains out of scope. This refactor only data-models the existing discussion checkpoint interaction.

No expansion of overall scope; the `interactions:` top-level is a small symmetric addition alongside `phases:` and `hooks:`, with no new commands or runtime behavior.

## Round 2 (fresh)

### F2.1 (fresh) — Accepted

Reviewer correctly identified that `src/commands/review.js` was missing from the consumers-second migration. `printReviewArtifacts()` at lines 71-79 reads `artifactPaths.brainstorm.proposal` / `.design` directly; the implementation-review artifact list at lines 188-206 hard-codes `brainstorm/design.md` and `breakdown/plan.md` as string literals; `commandPhases` and `artifactPaths` are imported at line 8. If the manifest's `requires:` / `produces:` contract changes, `specdev review <phase>` would still instruct human and automated reviewers to inspect the old files — directly weakening the review gate this refactor is making manifest-backed.

**Revision applied:**

1. **Design § Migration path — Consumers second** — Added an explicit bullet for `src/commands/review.js`: `printReviewArtifacts()` (lines 71-79) and the implementation-review list at lines 188-206 derive the review artifact list from the active phase's `requires:` (and the prior phase's `produces:` when reviewing implementation needs to also show design/plan context). Discussion review continues to use its existing brainstorm-artifact mapping, routed through the same helper.
2. **Design § Testing approach — manifest-as-truth integration test** — Extended to assert that `specdev review <phase> --round <n>` printed artifact list tracks manifest changes, in addition to the state-detection and workflow-status surfaces.

No new runtime behavior added; `review.js` joins the same `renderStepOutput` / manifest-read pattern used by `checkpoint.js`, `approve.js`, etc.

## Round 3 (fresh)

### F3.1 (fresh) — Accepted, expanded scope

Reviewer correctly identified that `src/commands/init.js` (lines 194-240) contains the source-of-truth template for the generated `specdev-reviewloop` SKILL.md installed into `.codex/skills/specdev-reviewloop/SKILL.md` and `.claude/skills/specdev-reviewloop/SKILL.md`. That template hard-codes the autocontinue contract (lines 203-205, 216-224), the reviewer-carry instruction (line 222), and the review-only vs review-then-autocontinue prompt — the exact prose that drives the "stops after approval" and reviewer-drift bug classes this refactor is meant to eliminate. Migrating only the core SKILL.md files leaves `specdev init`/`specdev update` reinstalling stale host-facing prose.

A comprehensive sweep of `src/**/*.js` while addressing this finding also surfaced additional consumers not yet in the migration list, all of the same drift class:

- `src/commands/reviewloop.js:31` — hard-codes `${name}/review/brainstorm-changelog*.md and ${name}/brainstorm/design.md` in a user-visible prompt.
- `src/commands/implement.js:24,26` — hard-coded `breakdown/plan.md not found` error.
- `src/commands/revise.js:16,18,51` — hard-coded `brainstorm/design.md` references.
- `src/utils/state.js:62,81,202,216,277` and `src/utils/workflow-runtime.js:494,498` — `next_action` strings naming specific files.
- `src/commands/init.js:34-37` — `commandPhases.review`, `.checkReview`, `.reviewloop` usage in template generation.
- `src/commands/reviewloop.js:464` — `commandPhases.reviewloop` usage.

`src/commands/migrate-legacy-assignments.js:10-12,178` is intentionally excluded — it's the legacy→current layout migration and its hard-coded paths are its purpose.

**Revision applied:**

1. **Design § Migration path — Consumers second** — Added two new bullets:
   - **Generated command-skill templates in `src/commands/init.js`** (lines 194-240 and any other template entries that prescribe phase-specific commands or option lists): migrate to the same generic "render runtime `interaction` / `continuation` blocks exactly" rule. Applies to `specdev-reviewloop`, `specdev-continue`, `specdev-check-review` template entries and their installed mirrors at `.codex/skills/specdev-*/SKILL.md` and `.claude/skills/specdev-*/SKILL.md`.
   - **Remaining hard-coded artifact-path string literals** across `src/`: explicit list of `reviewloop.js:31`, `implement.js:24,26`, `revise.js:16,18,51`, `state.js:62,81,202,216,277`, `workflow-runtime.js:494,498` — all migrate to derive paths from the active manifest's `produces:` / `requires:`.
   - **Explicit exclusion**: `migrate-legacy-assignments.js` allowlisted in the drift test.
2. **Design § Testing approach — drift test** — Restructured into four explicit assertion classes: manifest contract presence, core SKILL.md prose, generated command-skill templates + installed mirrors (no hard-coded choice labels / reviewer-carry / post-gate continuation strings), and a **repo-wide hard-coded artifact-path sweep** that rejects literal `brainstorm/proposal.md`, `brainstorm/design.md`, `breakdown/plan.md`, `implementation/progress.json` strings or `artifactPaths.<phase>.<name>` member accesses outside the derived-view module and the allowlisted legacy migration command. Same scan for `gateFields.<phase>` and `commandPhases.<*>`.
3. **Success Criteria § Skill prose minimized** — Extended to call out generated command-skill templates and their installed mirrors at `.codex/`/`.claude/` paths.

The expanded scope stays within the three-layer refactor: the generated templates are themselves consumers of the manifest contract, the same way `checkpoint.js`/`approve.js`/`review.js` are. The drift test sweep is the catch-all that closes the remaining unenumerated consumers — any future hard-coded path will fail the test rather than slip into a release.

---

# Second fresh review cycle (after archiving rounds 4-6 to `brainstorm-feedback-rounds-4-6.md`)

## Round 1 (cycle 2)

### F1.1 (cycle 2) — Accepted

Reviewer correctly identified that the design said `detectAssignmentState`'s state name is "derived from the manifest step id and kind" but did not specify the *structured state contract* that consumers would read. Multiple downstream consumers currently parse legacy state strings or prefixes:

- `src/utils/workflow-runtime.js` — `hookOutcomesForState`, `interactionForDetectedState`, `actionForDetectedState`, `buildTrace` all branch on state-name strings.
- `src/commands/continue.js` — `detected.state.startsWith('brainstorm') ? 'brainstorm' : 'implementation'` for review-feedback path resolution.
- `src/commands/context.js` — prefix-derived phase.
- `src/commands/check-review.js` — "anything not brainstorm becomes implementation."

Under the prior design, even after `detectAssignmentState` was manifest-aware these consumers could keep parsing legacy strings and silently disagree with manifest-derived phases/steps. The "manifest-as-truth" contract would have a hole at the consumer layer.

**Revision applied:**

1. **Design § Layer 2 — `detectAssignmentState` return shape** — Replaced the prior "state name is derived" sentence with an explicit structured state contract:
   ```js
   { phase, stepId, stepKind, status, completedPhases, gate, state, blockers, progress }
   ```
   The legacy `state` string is kept as a derived back-compat field for one release; internal readers must switch to structured fields. The string is removed in a follow-up cleanup.
2. **Design § Layer 2 — String-based consumer migration** — Added an explicit bullet enumerating every consumer that branches on legacy state strings, with the exact migration: `workflow-runtime.js` renderers read `(phase, stepId, stepKind, status)`; `continue.js`, `context.js`, `check-review.js` read `detected.phase` directly. `check-review.js` explicitly rejects `null` phase rather than defaulting to implementation.
3. **Mutated-manifest test** — Strengthened to assert that `specdev next`, `continue`, `context`, and `check-review` all infer phase, interaction block, hook outcomes, and review-feedback paths from the structured state — verified by adding a synthetic intermediate phase to the test manifest and observing `detected.phase` flow through to the correct review-feedback file path.

No new module added; the structured shape is just `detectAssignmentState`'s return value, consumed everywhere it's currently consumed. The transient legacy `state` string keeps external `specdev status --json` consumers working through the release window.
