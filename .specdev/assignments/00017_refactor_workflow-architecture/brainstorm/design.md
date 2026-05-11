# Workflow Architecture Refactor — Design

## Overview

SpecDev's workflow definition is currently spread across skill prose, `_main.md`, `_index.md`, guides, templates, and Node commands. The same structured facts appear in multiple places: phase names, valid CLI phase arguments, assignment types, required design sections, artifact paths, and gate/status field names. A downstream brainstorm surfaced several bugs whose common root cause is drift between duplicated copies.

This refactor introduces a small workflow contract for those facts and updates the existing CLI validators to read from it. It does not add a new orchestration model, guard-script runtime, or knowledge migration. The design keeps SpecDev's current phase detection model: `.current` points to the active assignment, while phase/state is computed from filesystem artifacts and gate files.

One adjacent feature rides alongside the refactor because it addresses the same workflow-drift problem from the agent's side:

- A **phase-end workflow FAQ capture path** that lets the agent record reusable workflow issues, confusions, command gotchas, and resolved contradictions into `knowledge/workflow/` as searchable FAQ notes.

The deliverable is a pragmatic foundation: central contract data, CLI integration for existing checkpoint/approve/status behavior, tests that catch drift, a small set of representative fixes that prove the contract is active, and an explicit workflow FAQ capture/search loop built on existing `knowledge/workflow/`.

## Non-Goals

This refactor is intentionally small. Out of scope:

- **Workflow rewrite.** The 4-phase workflow stays the same: brainstorm, breakdown, implement/implementation, capture/summary. No phase is added, removed, or semantically changed.

- **Phase-entry guard scripts.** No setup/run/validate runtime is introduced. Existing commands keep doing validation directly in Node.

- **Knowledge directory migration.** Existing `knowledge/architecture`, `knowledge/codestyle`, `knowledge/domain`, and `knowledge/workflow*` directories stay as they are. No `always_load` directory is added.

- **Documentation collapse.** `_main.md`, `_index.md`, and `_guides/` remain. They may be validated against contract facts where practical, but they are not removed.

- **Assignment artifact format changes.** `proposal.md`, `design.md`, `plan.md`, `progress.json`, and capture files keep their current shapes.

- **Prompt prose cleanup.** Contradictory or unclear instructions inside SKILL.md prose are handled separately unless they are directly tied to a contract fact.

- **All known workflow bugs.** This assignment fixes only a few representative drift bugs. The rest become follow-up work.

## Design

### 1. Contract Boundary

Add one small source of truth for structured workflow facts. Prefer a JS module if that keeps integration simple (`src/utils/workflow-contract.js`), or JSON plus a loader if tests/templates benefit from plain data (`src/workflow-contract.json`). The contract should start with only fields that existing code already uses:

- Canonical phase ids: `brainstorm`, `breakdown`, `implementation`, `capture`.
- User-facing aliases where they exist: `implement` for implementation, `summary` for capture.
- CLI phase support per command, such as `checkpoint`, `approve`, `review`, and `reviewloop`.
- Assignment types: `feature`, `bugfix`, `refactor`, `familiarization`.
- Required brainstorm design sections per assignment type.
- Core artifact paths for phase/state detection.
- Gate/status field names such as `brainstorm_approved` and `implementation_approved`.

Do not include broad prose, prompt text, examples, knowledge taxonomy, workflow FAQ schema, or future guard definitions in the first contract. Those can be added later only when a real consumer exists.

### 2. CLI Integration

Replace local duplicated constants with contract reads where the code already performs validation.

Initial targets:

- `src/commands/assignment.js`: use contract assignment types for `--type` validation and fallback help text, rejecting unsupported typed assignment folders at creation time.
- `src/commands/init.js`: render generated command-skill prose from contract-owned assignment type and review phase lists where those facts appear in `specdev-assignment`, `specdev-review`, `specdev-check-review`, and `specdev-reviewloop`.
- `src/commands/checkpoint.js`: replace `VALID_PHASES` and `REQUIRED_SECTIONS`.
- `src/commands/approve.js`: replace `VALID_PHASES`.
- Status/continue detection utilities: replace hard-coded artifact and gate names where doing so is straightforward and does not obscure the state machine.
- Review/reviewloop phase validation: use the contract for accepted review phases.

Keep validation functions in Node. The contract supplies data; it does not execute behavior. This avoids introducing a guard-script protocol before the current codebase needs it.

### 3. Drift Validator

Add a test or script that checks high-value surfaces against the contract. It should be narrow and deterministic:

- Command help and validation lists include only the phases declared for that command.
- Generated command skills in `src/commands/init.js` use the contract-declared assignment types and accepted review/reviewloop/check-review phases instead of hard-coded lists.
- The brainstorm design template contains the required sections for each assignment type or clearly documents that sections vary by type.
- `_main.md` and `_guides/workflow.md` use the canonical phase names and accepted aliases consistently.
- `_main.md` tells agents that if they encounter workflow issues, confusion, contradictions, or command gotchas, they should search `knowledge/workflow/` via `specdev knowledge search` before guessing.
- Template artifact paths referenced in docs match contract artifact paths.

This validator should fail tests when drift is introduced. It should not try to parse every sentence in every guide.

### 4. Representative Fixes

This assignment should fix a small number of real drift bugs through the new contract so the foundation is proven, not abstract. Good candidates:

- Phase naming inconsistency: normalize code and docs around canonical `implementation` with user-facing `implement` where appropriate.
- Required design sections: make checkpoint validation and templates derive from the same section list.
- Valid command phase lists: ensure `checkpoint`, `approve`, `review`, and `reviewloop` reject/accept phases from the contract consistently.
- Assignment type boundary: ensure `specdev assignment --type=<type>` accepts only contract-declared assignment types and renders help from the same list.

If one candidate turns out to require broad prose edits, defer it and pick another small drift issue. The proof should stay cheap.

### 5. Phase-End Workflow FAQ Capture

When the agent reaches the end of a phase, it should briefly consider whether the phase exposed reusable workflow knowledge. This is not a standing-order system and does not inject notes into every session. It is a searchable FAQ path for issues that future agents can query when confused.

Add guidance to the relevant phase skills and/or `knowledge-capture/SKILL.md`:

- At phase end, ask: "Did this phase reveal a reusable workflow issue, command gotcha, contradiction, or clarification?"
- If yes, search existing workflow knowledge first: `specdev knowledge search "<workflow issue keywords>"`.
- If an existing note answers the issue, update it with the new example or assignment reference.
- If no note exists, create a concise FAQ-style note in `knowledge/workflow/<short-slug>.md`.
- Run `specdev knowledge index` after writing or updating workflow notes.
- If the issue is about improving SpecDev itself rather than using the current project's workflow, classify it under `knowledge/workflow_feedback/` using the existing workflow feedback note process.

Recommended FAQ shape:

```markdown
# <Question or Gotcha>

## Short Answer
<What should the agent do?>

## Applies When
<When this guidance is relevant>

## Example
<Command, decision, or concrete situation>

## Source
- Assignment: <assignment id/name>
- Phase: brainstorm | breakdown | implementation | capture
```

Capture criteria:

- Capture recurring or generalizable workflow knowledge, especially issues that caused confusion, rework, failed commands, review feedback, or contradictory interpretations.
- Do not capture one-off task instructions, transient user preferences, ordinary implementation details, or low-value reflections.
- When in doubt, prefer not to create a new note; repeated friction can be captured later.

Master guide update: `_main.md` should explicitly tell agents that when they encounter workflow issues, confusion, contradictions, or command gotchas, they should run `specdev knowledge search "<issue>"` and inspect `knowledge/workflow/` before guessing.

No new CLI command is introduced. A future `specdev remember workflow` helper can be considered only if direct file editing proves too much friction.

### 6. Files Touched

Expected implementation areas:

- `src/utils/workflow-contract.js` or `src/workflow-contract.json`
- `src/commands/assignment.js`
- `src/commands/init.js`
- `src/commands/checkpoint.js`
- `src/commands/approve.js`
- `src/commands/review.js`
- `src/commands/reviewloop.js`
- State/status helpers if artifact/gate names are currently duplicated there
- `templates/.specdev/_templates/brainstorm-design.md`
- `templates/.specdev/_main.md`
- `templates/.specdev/skills/core/knowledge-capture/SKILL.md` or phase skills, whichever is the narrowest place to add phase-end workflow FAQ capture guidance
- Focused tests under `tests/` including new tests for contract drift and workflow FAQ guidance

Do not edit installed runtime state under `.specdev/` during implementation unless the assignment artifacts themselves are being revised.

## Success Criteria

- Workflow facts used by checkpoint/approve/review flows come from one contract source.
- Existing behavior is preserved except for explicitly chosen drift fixes.
- Tests fail if command phase lists, generated command-skill lists, required brainstorm sections, or core artifact paths drift from the contract.
- `specdev assignment --type=<type>` validates against contract assignment types and rejects unsupported types before creating folders.
- At least 2 representative drift bugs are fixed using the new contract.
- `_main.md` tells agents to search workflow FAQ knowledge when they hit workflow issues, confusion, contradictions, or command gotchas.
- Phase-end or capture guidance tells agents how to create/update concise FAQ-style notes in `knowledge/workflow/` and when to use `knowledge/workflow_feedback/` instead.
- No always-load directory, SessionStart hook change, always-apply durable-learning skill, guard-script runtime, sub-phase recursion, documentation collapse, batch knowledge migration, or new `specdev remember` CLI command is introduced in this assignment.
