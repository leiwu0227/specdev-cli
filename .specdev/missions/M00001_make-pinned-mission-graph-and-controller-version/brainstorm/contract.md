# Mission contract

Kind: mission

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make pinned Mission graph and controller version skew safely detectable,
migratable, and recoverable without turning evidence-backed success into a
delivery failure. The incident, current fallback, and target scenarios are
recorded in
`.specdev/project_notes/thoughts/2026-08-01_pinned-mission-graph-cannot-route-evidence-closure.md`.

## Scope and non-goals

- In scope: preflight validation of controller dispositions against the pinned
  Mission graph; an explicit durable migration from
  `mission-lifecycle@1.3.0` to `@1.4.0` for unambiguously mapped non-terminal
  runs; constrained recovery of the known terminal evidence-closure
  compatibility failure; distinct incompatibility status and actionable CLI
  output; focused regression coverage.
- Non-goals: silently upgrade pinned runs during `specdev update`, build a
  generic arbitrary-version graph migration framework, change oceandata_tau
  product code, reinterpret genuine objective/authority/verification failures,
  or rerun provider work when durable resolver/arbiter evidence is reusable.

## Expected behavior

Before `mission run` launches a worker, reviewer, resolver, or arbiter, SpecDev
compares every controller disposition reachable from the Mission's current
phase with the pinned node schemas. A known supported mismatch reports
`migration-required` and the exact explicit migration/recovery command; an
unknown mismatch reports `workflow-incompatible`. Neither state changes the
Mission's delivery disposition or launches a provider.

The supported `1.3.0` → `1.4.0` migration verifies an exact mapping for the
current run position, graph package, durable Mission status, queue, gaps, and
recorded results. It records old/new package identities, reason, timestamps,
and write progress durably; preserves the approved contract hash, run identity,
child delivery commits, Attempts, gap evidence, and verification receipts; and
is idempotently resumable after every write boundary. If a durable
`evidence-closed` resolver/arbiter result already exists, the migrated run
records that transition and continues without another provider call.

Recovery of an already-terminal compatibility failure is allowed only when the
Mission's exact recorded failure signature identifies the pinned-graph
evidence-closure fallback and the referenced gap has durable positive closure
evidence. Recovery migrates the run, restores the gap to `evidence-closed`,
retains successful final-verification evidence and checkpoints, and resumes the
normal completion/landing path. Genuine semantic, authority, implementation,
or verification failures remain terminal.

## Important decisions

- Workflow pinning remains the default. Migration is an explicit semantic
  command with a version-specific mapping, never a side effect of update or
  ordinary status reads.
- Compatibility is checked before provider launch and again at the transition
  boundary; a late mismatch stays recoverable and is not rewritten to
  `infrastructure-failure`.
- Migration mutates one existing run in place so durable Mission and run
  identity remain stable. It does not create a replacement Mission or replay
  provider Attempts.
- Terminal recovery recognizes the exact historical fallback signature plus
  positive gap evidence; broad status-based resurrection is forbidden.
- `mission-lifecycle@1.4.0` remains the normal direct path for new Missions and
  must not require migration logic.

## Constraints and invariants

- Contract approval authority, base revision/branch, queue ordering, child
  delivery revisions, gap history, Attempt records, and verification receipts
  are preserved byte-for-byte except for narrowly specified migration metadata
  and corrected compatibility disposition.
- Migration uses atomic writes and a durable journal/state marker. Rerunning
  after interruption neither duplicates transitions nor loses prior evidence.
- Unknown versions, ambiguous positions, missing evidence, mismatched gap IDs,
  and already-genuine terminal failures fail without mutating the run.
- Compatibility preflight must not start a provider process before returning an
  incompatibility or migration decision.
- Existing Mission pinning, direct `1.4.0` evidence closure, pause/takeover,
  checkpointing, completion, and fast-forward-only landing remain compatible.

## Delegated and reserved authority

- Delegated: exact migration command spelling and JSON schema, version mapping
  representation, journal location/shape, compatibility-matrix implementation,
  recovery signature encoding, actionable error text, child decomposition, and
  focused fixtures consistent with this contract.
- Reserved for the user: Mission contract approval, initiating explicit
  migration/recovery against a real repository, test execution approval, and
  expansion to graph versions or failure classes not named here.

## Risks and assumptions

- RippleGraph may not expose a public pinned-run migration primitive; a safe
  implementation may require a narrowly validated SpecDev adapter around its
  persisted checkpoint/package metadata rather than a general dependency
  change.
- Historical terminal incidents may lack one required receipt or have diverged
  after manual recovery. Those cases must remain incompatible instead of being
  guessed into success.
- Preflight can validate declared controller dispositions and known graph
  schemas, but it cannot prove arbitrary future controller behavior; the
  transition-boundary guard remains required.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A Mission pinned to an incompatible known or unknown graph is stopped
  before any provider launch with `migration-required` or
  `workflow-incompatible`, an exact next action, and no delivery-failure
  mutation; a compatible `1.4.0` Mission continues normally.
- AC-2: Supported active `1.3.0` → `1.4.0` migration preserves all named
  authority, identity, queue, delivery, gap, Attempt, checkpoint, and
  verification evidence; resumes safely after each injected write-boundary
  interruption; and consumes an existing `evidence-closed` result without a
  new provider call or duplicate transition.
- AC-3: The historical terminal fallback is recoverable only when its exact
  signature, gap identity, and positive closure evidence agree, after which the
  Mission can complete and become landable while retaining successful final
  verification and checkpoint evidence.
- AC-4: Genuine semantic, authority, implementation, and verification failures,
  ambiguous/missing evidence, and unsupported graph versions cannot use the
  recovery path and remain unchanged with actionable diagnostics.

## Mission execution shape

- Initial child plan: planned
- Split reason: sequential dependency boundaries: compatibility preflight and
  status semantics; active-run migration and crash recovery; then constrained
  terminal recovery plus integrated regression evidence.

<!-- Use planned only for a concrete context, dependency, decision, or independent verification/rollback boundary. -->

## Final integrated verification

- Command: `npm run test:mission-compatibility`
