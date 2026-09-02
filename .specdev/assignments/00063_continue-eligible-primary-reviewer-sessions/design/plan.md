# Implementation plan

## Guides

**Implementation Guides:** api-security

**Review Guides:** none

## Tasks

- T-1 (AC-1, AC-2): Add an adapter-owned reviewer-session capability. Keep
  ordinary Claude invocations ephemeral, but let primary implementation reviews
  request a fresh structured result with an exact session identity or resume that
  identity under the same read-only profile.
- T-2 (AC-1, AC-2, AC-3): Add provider-neutral Attempt continuity metadata and
  an ignored, versioned, Assignment-scoped one-use lease with exact identity,
  profile, permission, contract, cwd, candidate, findings, source-Attempt, and
  round bindings.
- T-3 (AC-2, AC-3): Integrate conservative continuation eligibility into the
  standalone Assignment primary-review path, render bounded candidate/evidence
  deltas, consume leases before launch, and allow at most one failed resume
  Attempt followed by one fresh fallback Attempt.
- T-4 (AC-1, AC-2, AC-3): Add focused adapter, lease, Attempt-lineage,
  invalidation, role-isolation, and fallback regressions plus user-facing
  workflow documentation.

## Verification plan

- Focused provider, lease, and Attempt coverage in
  `tests/test-vnext-foundations.js`.
- Focused end-to-end Assignment review continuation and fallback coverage in
  `tests/test-reviewloop-modes.js`.
- Formatting and the full test suite only after explicit user authorization.
