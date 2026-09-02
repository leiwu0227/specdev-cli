# Implementation plan

## Guides

**Implementation Guides:** api-security

**Review Guides:** none

## Tasks

- T-1 (AC-1, AC-2): Make provider adapters own normalized filesystem/network
  policy, reject unsupported network-enabled combinations before Attempt
  creation, and support Codex reviewer live search through an exec-scoped config
  override under the read-only sandbox.
- T-2 (AC-3): Persist adapter-derived effective access in spawned Attempts,
  conservatively read older Attempt records, and freeze complete Mission review
  profiles at approval.
- T-3 (AC-3): Make Mission convergence reviews consume the frozen reviewer
  profile while preserving current executor-environment drift checks.
- T-4 (AC-1, AC-2, AC-3): Update the managed profile template, README guidance,
  and focused provider, Attempt, and Mission regression coverage.

## Verification plan

- Focused profile/provider/Attempt coverage in `tests/test-vnext-foundations.js`.
- Focused Mission policy coverage in `tests/test-mission-environment.js`.
- Formatting and the full test suite only after explicit user authorization.
