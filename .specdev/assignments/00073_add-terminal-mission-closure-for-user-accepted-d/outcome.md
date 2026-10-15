# Outcome

## Delivered behavior

Added `specdev mission close <id> --outcome=accepted-with-limitations --evidence=<note>`.
The read-only plan binds the acceptance text, candidate, exact mutable-file hashes,
retained artifacts, children, Attempts, and scheduler state. Explicit confirmation
records the distinct outcome without converting incomplete verification to success.
Unfinished children close, stale Attempts become interrupted, owned focus is released,
and an exact closure commit preserves unrelated staged and unstaged work. All code,
contracts, verification records, artifacts, and scheduler history remain retained.
Retries recover confirmed closure without duplicating commits or clearing later focus.

## Deviations

None. An exact closure commit is necessary to let subsequent Adhoc work pass its
clean-start check after the execution boundary is released.

## Unresolved risks

Closure refuses historical parallel or ambiguous child execution ownership. External
processes can race file checks; detected changes stop closure and retain its recovery
state. Unrelated dirty product work still requires the normal Adhoc ownership decision.

| Acceptance | Evidence | Result |
| ---------- | -------- | ------ |
| AC-1 | `node tests/test-mission-closure.js`: missing evidence, unsupported outcomes, live execution, and changed note/artifact/queue/product state refuse closure without lifecycle mutation. | Passed |
| AC-2 | `node tests/test-mission-closure.js`: failed verification, missing evidence, contracts, product bytes, nested scheduler outputs and history remain retained; outcome stays unverified. `npm run test:mission-abandonment` and `npm run test:mission-landing` preserve existing terminal behavior. | Passed |
| AC-3 | `node tests/test-mission-closure.js`: active child termination, four interruption boundaries, exact retries, terminal mutation guards, unrelated index/worktree preservation, later focus preservation, and successful subsequent Adhoc start. | Passed |
