# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

No catalog guide applies to this CLI-only status projection: `frontend` is
browser-specific and `api-security` concerns trust boundaries that this change
does not alter.

## Tasks

### T-1 — Define one active-first status projection (AC-1, AC-2)

Refactor the shared engine status path so it first builds one validated status
result, then selects either a concise default projection or the existing full
history projection. Include only applicable focus, lifecycle/phase, active
Attempt or pending decision, next semantic command, dirty-path summary, and
blocker fields in the default shape.

### T-2 — Render human and JSON status consistently (AC-1, AC-2)

Make `specdev status` render a concise human view by default, keep structured
output behind `--json`, and make `--history` select the equivalent historical
view for both formats without changing explicit Assignment or Mission status
commands.

### T-3 — Add focused deterministic fixtures and command wiring (AC-1, AC-2)

Add focused coverage for active, blocked/interrupted, and idle default/history
views, including both human and JSON projections. Wire a narrow status test
command that the Mission's later integrated visibility command can compose
without broadening the product behavior under test.

### T-4 — Verify and record delivery evidence (AC-1, AC-2)

After obtaining the repository-required user confirmation, run only the focused
format/check commands and status fixtures needed to demonstrate the acceptance
criteria. Record exact commands, revision, scope, status, and duration in the
Assignment progress and outcome artifacts.
