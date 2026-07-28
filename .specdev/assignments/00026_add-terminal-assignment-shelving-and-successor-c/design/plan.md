# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

1. **T-1 — Add the terminal shelf transition and durable recovery boundary (AC-1, AC-3).**
   Implement lifecycle validation, required reason handling, live Attempt protection,
   clean-HEAD capture, explicit path-by-path snapshot authorization, an idempotent
   human-readable shelf record, and terminal RippleGraph cleanup for standalone
   Assignments only.
2. **T-2 — Create fresh successor Assignments from shelves (AC-2).**
   Validate `--from-assignment` independently of existing Discussion and Test Audit
   promotions, reserve a new Assignment ID, persist predecessor lineage, and seed the
   new contract with a bounded historical handoff without restoring approval, review,
   verification, or graph state.
3. **T-3 — Make lifecycle-aware commands and installed guidance safe and explicit
   (AC-3).** Update focus, continue, status, global help, cancellation validation, and
   generated `specdev-continue` guidance so terminal Assignment states are distinct,
   shelf continuation points to the exact successor command, and help flags cannot
   trigger mutation.
4. **T-4 — Add focused regression coverage and record authorized verification
   (AC-1, AC-2, AC-3).** Extend the narrow command-level fixtures for shelf eligibility,
   idempotency, dirty snapshot authorization, successor lineage, promotion
   compatibility, terminal output, and non-mutating help. Run only non-test static
   checks unless the repository-required user confirmation for focused tests is
   supplied, and record any skipped test evidence as a blocker rather than guessing.
