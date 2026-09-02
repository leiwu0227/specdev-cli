# Implementation plan

**Implementation Guides:** []

**Review Guides:** []

## Context

- Approved contract: `brainstorm/contract.md`
- Roadmap authority: `project_notes/roadmap/designs/foundations/specdev_state_model.md` and `project_notes/roadmap/designs/foundations/installed_layout.md`
- Relevant history: Assignment 00032 terminal-runtime ownership guards and Assignment 00056 default-deny concurrent ownership

## Tasks

1. **T-1 — Shared maintenance quiescence model**
   - Add provider-neutral inspection over durable Attempt records.
   - Reuse local process liveness, treat unreadable ownership as ambiguous, and reconcile only confirmed stale local execution to `interrupted`.
2. **T-2 — Update entry-point enforcement**
   - Gate initial mutation before skill-root repair and gate resumed update-completion transitions.
   - Keep dry-run and status inspection-only while exposing structured quiescence facts and actionable human diagnostics.
3. **T-3 — Guidance and focused regression coverage**
   - Document the no-bypass maintenance boundary.
   - Cover live, unknown, malformed, stale, read-only, retry, successful update, and resumed-operation behavior in existing focused fixtures.
4. **T-4 — Delivery evidence**
   - Run only user-authorized focused verification, record receipts, summarize acceptance evidence, and submit the candidate to required implementation review.

## Intended focused verification

- `node tests/test-update-workflow.js`
- `node tests/test-update-skill-roots.js`
- `node tests/test-update-skills.js`
- `node tests/test-assignment-shelf.js`

## Acceptance coverage

- **AC-1:** T-1 classifies every durable running Attempt; T-2 gates both initial update and resumed update-completion mutation before the first owned write; T-3 covers live, unknown, malformed, ownership, and unchanged-path diagnostics.
- **AC-2:** T-1 bounds stale reconciliation to confirmed dead local execution, preserves non-running records and owning workflow state, and performs a fresh inspection; T-3 covers reconciliation, retry, and shared shelf compatibility.
- **AC-3:** T-2 keeps dry-run and status inspection-only while preserving quiescent update and adapter completion; T-3 verifies those read-only and compatibility paths.
