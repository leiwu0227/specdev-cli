# Implementation plan

**Implementation Guides:** []

**Review Guides:** []

## Context

- `.specdev/project_notes/roadmap/designs/workflow/lanes/adhoc_lane.md`
- `.specdev/assignments/00056_prevent-adhoc-from-implicitly-shelving-active-as/outcome.md`
- `.specdev/knowledge/architecture/reduced-test-suite.md`

## Tasks

1. **T-1 — Generalize focused coexistence ownership (AC-1, AC-3).** Replace the Assignment-only resolver and protected-path model with an owner-neutral Assignment/Mission classifier, a closed safe-position allowlist, full Mission/child path protection, Attempt-liveness checks, and fail-closed diagnostics.
2. **T-2 — Enforce detour and revalidation gates (AC-1, AC-2).** Persist focused-owner snapshots, block all focused advancement during Adhoc, retain a durable finish/cancel revalidation obligation with revision and changed-path facts, and require an explicit revalidation action before the focused workflow can cross approval, execution, or Git boundaries.
3. **T-3 — Align interfaces and focused coverage (AC-2, AC-3).** Update Adhoc payloads/receipts, CLI help, template and embedded skills/workflow guidance, and compact command-level fixtures for Assignment brainstorming, Mission/child formation, safe completion/cancellation, revalidation, and every unsafe boundary.

## Verification

Any test command requires the user's explicit approval under repository instructions. After approval, run the narrow Adhoc/engine integration coverage and generated-platform guidance checks; expand only if those results expose a broader risk.
