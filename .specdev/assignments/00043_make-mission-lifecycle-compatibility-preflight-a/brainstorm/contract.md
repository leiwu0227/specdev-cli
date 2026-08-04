# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Mission lifecycle compatibility preflight and migration phase-aware before
Design. The reproduced deadlock and recovery history are recorded in
`.specdev/project_notes/thoughts/2026-08-04_fresh-mission-promotion-migration-deadlock.md`:
a valid 1.3.0 Mission at Brainstorm could neither run without migration nor
migrate without a Design queue that could not legally exist yet.

## Scope and non-goals

- In scope: exact `mission-lifecycle@1.3.0` to `@1.4.0` migration at
  `create-mission`, `brainstorm`, and `approve-mission` without a queue;
  phase-specific journal validation and crash recovery; compatibility responses
  that distinguish a missing target package from an installed and runnable
  migration; and integrated create/update/migrate regression coverage.
- Non-goals: Mission supersede/recreate semantics; Discussion promotion seeding
  or objective normalization; Mission Brainstorm-review policy; migration-skill
  taxonomy or guidance; updater-owned dirty-path classification; changing graph
  pinning or approval authority; or general migration between arbitrary graph
  versions.

## Expected behavior

- With the 1.4.0 package installed, a valid pre-Design 1.3.0 Mission migrates in
  place without reading, creating, or requiring `design/assignments.yaml`. It
  retains the exact root phase and all durable authority already valid at that
  phase, then `mission run` can continue normally.
- Compatibility preflight advertises `specdev update` when the target package is
  absent, advertises `specdev mission migrate <id>` only when the current phase
  and durable prerequisites are supported, and returns an actionable
  non-runnable compatibility state otherwise.
- Designed, running, and terminal migration/recovery paths retain their existing
  strict queue, gap, evidence, and non-mutation checks.

## Important decisions

- Classify the pinned version, target-package availability, root phase, and
  migration mode before reading phase-specific artifacts.
- A migration journal explicitly distinguishes a legally absent pre-Design queue
  from a present queue whose digest is authoritative. Absence is not represented
  by a fabricated empty queue.
- Pre-Design mapping may change only the pinned graph source and exact
  version-specific checkpoint representation. It preserves contract content and
  hash, Discussion source authority, review artifacts, approval state, base
  revision, branch, outputs, gate decisions, stack identity, and Mission ID.
- Compatibility evaluation is read-only and uses the same phase-support rules as
  the migrator so it never recommends a command that deterministically fails.
- Mission graph migration remains command-owned and journaled; it does not invoke
  or require filesystem layout-migration planning.

## Constraints and invariants

- Existing exact-hash approval, review evidence, workflow pinning, provider
  barriers, and Git authority remain unchanged.
- At `approve-mission`, an unapproved checkpoint remains unapproved, while a
  durably approved Mission remains approved; migration must never synthesize or
  discard approval.
- No child ID is reserved and no worker/reviewer provider is launched during
  compatibility evaluation or migration.
- Every pre-Design write boundary is resumable and idempotent. A rejection before
  journal creation leaves Mission, checkpoint, contract, review artifacts, and
  source authority byte-identical.
- From Design onward, a missing, ambiguous, or invalid queue/gap/evidence record
  remains a fail-closed migration error and cannot be reclassified as pre-Design.

## Delegated and reserved authority

- Delegated: exact helper boundaries, journal field names, phase-capability model,
  diagnostic wording and status names, version-specific checkpoint mapping, and
  focused fixture construction within the constraints above.
- Reserved for the user: new lifecycle states or destructive recovery commands;
  copying approval to a new Mission identity; changing retention, promotion, or
  review policy; supporting additional graph-version pairs; and verification
  outside the authority below.

## Risks and assumptions

- Pre-Design checkpoints may contain different combinations of contract outputs,
  gate decisions, and approval fields; fixtures must distinguish checkpointed,
  awaiting-approval, and durably approved states rather than treating them as
  interchangeable.
- Target-package discovery must not confuse the installed catalog's current
  package with the source package pinned by the active run.
- Journal schema changes must remain readable for the active and terminal
  migrations delivered by Assignment 00035/00036 and must not weaken their
  digest guards.

## Verification authority

- Focused verification: `npm run test:mission-compatibility` may be run only after
  the repository-required explicit user confirmation.
- Full suite and every other test command: prohibited unless separately approved
  by the user.

## Acceptance criteria

- AC-1: For valid 1.3.0 Missions at `create-mission`, `brainstorm`, and
  `approve-mission`, with and without checkpointed contract/review evidence and
  with unapproved or durably approved authority as applicable, migration to
  1.4.0 succeeds without a queue, preserves the exact phase and durable
  authority/evidence, creates no child/provider activity, and allows normal
  `mission run` continuation.
- AC-2: Compatibility preflight returns an update-required action when the 1.4.0
  target package is absent, returns migration-required only for a supported phase
  with valid phase-specific prerequisites, and returns an actionable unsupported
  or invalid compatibility result without mutation when migration cannot run;
  existing post-Design strict queue/gap validation remains enforced.
- AC-3: The focused create/update/migrate scenarios interrupt every pre-Design
  journal write boundary and prove idempotent resume, explicit absent-queue
  journaling, exact authority preservation, no duplicate transitions, and
  byte-identical state when validation fails before journal creation, while the
  existing active and terminal migration fixtures continue to pass.
