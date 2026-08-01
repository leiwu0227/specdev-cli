# Implementation plan

## Tasks

### T-1 — Classify and reconstruct the authorized terminal recovery (AC-1, AC-2)

Extend the existing `mission-lifecycle@1.3.0` to `@1.4.0` migration planner with a terminal-only candidate that proves the historical fallback as one predicate: the Mission failure disposition and exact blocker signature, the terminal `replan` transition and referenced gap identity, and readable durable arbiter approval evidence must all agree. Reconstruct the pre-fallback Mission/checkpoint state, restore only that gap to `evidence-closed`, and feed it through the existing digest-guarded atomic migration journal. Reject genuine failures and every incomplete, ambiguous, or mismatched candidate before creating or changing durable state.

### T-2 — Resume recovered state through normal completion semantics (AC-1, AC-2)

Expose the terminal candidate through `specdev mission migrate <id>` while keeping ordinary terminal Missions immutable. Preserve prior verification/checkpoint artifacts and provider Attempts, resume the migrated run without launching a provider, and let the existing Mission controller replay the reconstructed transition, reuse the passed final-verification receipt, complete, checkpoint, and classify landing normally. Provide actionable fail-closed diagnostics for rejected candidates.

### T-3 — Integrate terminal compatibility regression coverage (AC-1, AC-2, AC-3)

Extend `test:mission-compatibility` with an exact historical terminal fixture, preservation and no-provider assertions, completion/landing coverage, and a matrix for genuine failures plus missing, ambiguous, and mismatched signature/gap/evidence cases. Keep the existing preflight, active migration, crash-resume, and direct `1.4.0` cases in the same focused command.

**Implementation Guides:** [api-security]

**Review Guides:** []

## Verification

- With explicit repository-required approval, run `npm run test:mission-compatibility` once against the completed working tree.
- Record the dirty candidate as `working-tree@<HEAD>`, including command scope, status, and duration in `implementation/progress.json`.
- Do not run the full suite; the approved integrated compatibility command is the narrowest sufficient evidence.
