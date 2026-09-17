# Implementation plan

**Implementation Guides:** api-security
**Review Guides:** api-security

## T-1 — Owned cache retention (AC-1, AC-2, AC-3)

Add shared path-safe cache inspection/deletion and terminal-owner eligibility helpers. Retire future scratch artifacts under explicit owner folders; recover known legacy Attempt ownership from remaining records and preserve unknown files. Delete caches before Attempt records, so failures retain retry authority. Keep existing terminal-run guards and protect shelved/recoverable owners.

## T-2 — Lifecycle integration and cleanup command (AC-1, AC-2, AC-3)

Connect successful/abandoned Assignment and Mission compaction to owned cache cleanup. Persist compact Discussion completion state/activity and use it for inspection, listing, and promotion after removing callable runtime. Add preview-default `specdev cleanup [--apply] [--json]` with terminal-state revalidation and explicit skipped/error reporting.

## T-3 — Evidence and delivery (AC-1, AC-2, AC-3)

Extend existing foundations, engine integration, abandonment, and shelving fixtures. Run the four commands explicitly approved by the user, document retention and cleanup, record evidence, then use `specdev implement` for required independent review and normal delivery. Keep `releaseDate` current. Do not apply cleanup to existing workspace leftovers or update installed workflow files.

Relevant historical context: `.specdev/assignments/00032_terminal-run-residual-artifact/outcome.md` confirms checkpoint-less recovery guards. `.specdev/knowledge/architecture/reduced-test-suite.md` describes an older suite layout; current `package.json` and retained suites are authoritative. No dependency changes are needed.
