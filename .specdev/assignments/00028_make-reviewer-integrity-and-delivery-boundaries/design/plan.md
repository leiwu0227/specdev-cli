# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

### T-1 — Scope reviewer integrity to product and active candidate

Acceptance: AC-1, AC-2

- Build reviewer snapshots from the protected product tree plus the exact
  Assignment, Mission, or Discussion candidate containing the reviewer result.
- Continue allowing reviewer results and host-owned workflow/runtime outputs
  while detecting tracked, untracked, deleted, and renamed protected inputs.

### T-2 — Scope Adhoc and standalone Assignment delivery

Acceptance: AC-3

- Treat `.specdev/discussions/**` and `.specdev/test-audits/**` as
  independently owned concurrent callable artifacts at the Adhoc dirty
  boundary.
- Replace broad Adhoc and standalone Assignment staging with reusable
  ownership-scoped staging that excludes and unstages concurrent callable
  artifacts while retaining product changes and normal SpecDev evidence.

### T-3 — Add focused boundary regressions

Acceptance: AC-1, AC-2, AC-3

- Cover unrelated Discussion/Test Audit changes during Assignment, Mission,
  and Discussion reviews.
- Prove active Discussion and product mutations still invalidate review.
- Prove Adhoc and standalone Assignment delivery commits owned changes and
  evidence without staging or committing unrelated callable artifacts.

### T-4 — Record focused verification and final evidence

Acceptance: AC-1, AC-2, AC-3

- Run only the repository-authorized focused checks after explicit
  confirmation, recording commands, tested revision, scope, status, and
  duration.
- Complete `implementation/progress.json` and `outcome.md` with deviations,
  risks, and acceptance evidence.
