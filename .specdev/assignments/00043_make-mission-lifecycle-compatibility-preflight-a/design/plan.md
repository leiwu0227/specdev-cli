# Implementation plan

**Implementation Guides:** [api-security]

**Review Guides:** []

## Tasks

### T-1 — Share phase-aware migration readiness with compatibility preflight (AC-1, AC-2)

Classify the exact pinned version, target-package availability, root Mission phase, and pre-Design versus designed/terminal migration mode before reading phase-specific artifacts. Make compatibility evaluation use the migrator's read-only planning boundary so it advertises `specdev update` when `mission-lifecycle@1.4.0` is absent, advertises `specdev mission migrate <id>` only when the current phase and durable prerequisites validate, and otherwise returns an actionable non-runnable state without mutation.

### T-2 — Migrate and recover pre-Design Missions without a queue (AC-1, AC-3)

Extend the exact `mission-lifecycle@1.3.0` to `@1.4.0` journaled mapping for `create-mission`, `brainstorm`, and `approve-mission`. Preserve the Mission record, contract/review artifacts, checkpoint outputs, gate decisions, approval authority, stack identity, and root phase while changing only the pinned graph representation. Record an explicit absent-queue journal state, retain compatibility with existing present-queue journals, and keep every write boundary digest-guarded, resumable, and idempotent.

### T-3 — Add integrated phase/preflight/recovery regression evidence (AC-1, AC-2, AC-3)

Extend `test:mission-compatibility` with create/update/migrate fixtures for target-package absence, all supported pre-Design phases and authority/evidence variants, actionable invalid prerequisites, queue-free continuation, every journal interruption boundary, exact preservation/no provider or child activity, and pre-journal byte stability. Keep the existing designed, active evidence-closure, and terminal recovery fixtures in the same focused command and record the authorized result in the delivery artifacts.

## Verification

- After explicit repository-required approval, run `npm run test:mission-compatibility` once against the completed working tree.
- Record the dirty candidate revision as `working-tree@<HEAD>` with duration and focused scope in `implementation/progress.json`.
- Do not run the full suite or any other test command.
