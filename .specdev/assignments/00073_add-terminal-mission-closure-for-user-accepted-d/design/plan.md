# Implementation plan

Implementation Guides: none
Review Guides: none

## T-1 — Exact closure authority (AC-1)
Add a focused Mission closure module. Bind written acceptance, checkout, artifact bytes,
child ownership, runtime state, and Attempts in a read-only confirmation plan.
Refuse unsafe execution and stale confirmation before durable mutation.

## T-2 — Retained terminal transaction (AC-2, AC-3)
Persist the confirmed plan and acceptance note before closing the owned run through
RippleGraph APIs. Preserve runtime history and verification artifacts. Close unfinished
children with prior status recorded, retain completed children, reconcile stale Attempts,
and clear only owned focus. Make interrupted writes recoverable and exact retries
idempotent. Update all affected terminal reporting and mutation guards.

## T-3 — Documentation, evidence, delivery (AC-1, AC-2, AC-3)
Update product help and template guidance. Add isolated CLI regressions for acceptance,
stale plans, nested children, retained evidence, terminal guards, recovery, and Adhoc.
Run the three user-authorized focused commands. Record outcomes and obtain the required
independent implementation review through specdev implement/reviewloop.

Context: src/commands/mission-abandon.js; src/utils/adhoc-focused.js;
.specdev/assignments/00064_add-explicit-mission-abandonment/outcome.md.
