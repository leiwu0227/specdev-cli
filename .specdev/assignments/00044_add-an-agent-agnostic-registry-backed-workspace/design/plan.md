# Design plan

**Implementation Guides:** api-security
**Review Guides:** none

## Tasks

### T-1 — Register the update-completion callable and adapter boundary model

Acceptance: AC-1, AC-2, AC-3

Add a versioned provider-neutral callable graph plus deterministic adapter discovery,
drift classification, protected-region hashing, operation identity, and validation
utilities. Keep callable inputs and receipts free of adapter source text while pinning
the installed package through RippleGraph's callable checkpoint.

### T-2 — Integrate durable completion and resumption into `specdev update`

Acceptance: AC-1, AC-2, AC-3

Extend human and JSON update output with runtime, adapter, operation, and exact
next-action fields. Start reconciliation only after runtime/package installation,
resume or inspect an existing operation without rerunning the deterministic update,
validate current orientation, obsolete-reference removal, and byte-preserved
project-owned sections, then emit a terminal receipt. Keep dry-run read-only and
leave foreground workflow focus/state untouched.

### T-3 — Add focused mixed-adapter and concurrency/pinning verification

Acceptance: AC-1, AC-2, AC-3

Add the approved `test:update-workflow` target and focused fixtures for current,
backfilled, bounded mixed-content, ambiguous, dry-run, focused-workflow concurrency,
interruption, and pinned-package resumption behavior. Update package inventory
expectations and concise user documentation for the new update statuses and resume
command.
