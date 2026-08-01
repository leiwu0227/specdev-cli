# Assignment contract

Kind: feature

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Implement the active-run migration authorized by
`.specdev/missions/M00001_make-pinned-mission-graph-and-controller-version/brainstorm/contract.md`
at approved hash `8f5844db8a82036c50e512ecdef69957bb6e53d1c2a93e1c17d0c87f1db04184`.
Build on prerequisite outcome
`.specdev/assignments/00034_add-mission-compatibility-preflight-and-incompat/outcome.md`.

## Scope and non-goals

- In scope: explicit, in-place, resumable migration of an unambiguously mapped
  non-terminal Mission run from `mission-lifecycle@1.3.0` to `@1.4.0`.
- Non-goals: compatibility preflight already delivered by Assignment 00034,
  terminal compatibility-failure recovery, generic cross-version migration,
  or any expansion of the Mission contract.

## Expected behavior

The migration command validates the supported source version and exact durable
run position, then journals and applies the version-specific transition. It is
safe to resume after interruption at any write boundary and reuses an existing
durable `evidence-closed` result without launching another provider.

## Important decisions

Migration updates the existing run in place through explicit, version-specific
mapping and durable progress metadata; it neither creates a replacement run nor
replays completed provider work.

## Constraints and invariants

Inherit all unchanged Mission constraints and invariants. In particular, retain
the approved contract hash, run identity, queue and gap state, child deliveries,
Attempts, checkpoints, and verification evidence; invalid or ambiguous input
must fail without mutation, and retries must not duplicate transitions.

## Delegated and reserved authority

- Delegated: the command/JSON shape, exact `1.3.0` to `1.4.0` mapping,
  journal representation, atomic-write sequence, diagnostics, and focused
  fixtures within the approved Mission authority.
- Reserved for the user: all authority reserved by the Mission contract,
  including initiating migration in a real repository and approving any new
  source/target version, recovery class, or scope expansion.

## Risks and assumptions

Assume Assignment 00034's compatibility classifications and transition guards
are the entry contract. RippleGraph may require a narrowly validated persistence
adapter; incomplete, unsupported, or divergent state must remain unchanged
rather than be inferred into a valid mapping.

## Verification authority

- Focused migration tests may verify exact mapping, evidence preservation,
  interruption at each write boundary, idempotent resume, invalid-state
  non-mutation, and provider non-replay, subject to repository test approval.
- Full-suite execution remains reserved for explicit user approval.

## Acceptance criteria

- AC-1: A valid non-terminal `mission-lifecycle@1.3.0` run migrates in place to
  `@1.4.0` while preserving all Mission-named authority, identity, queue, gap,
  delivery, Attempt, checkpoint, and verification evidence.
- AC-2: After interruption at any migration write boundary, rerunning the same
  command completes safely without duplicate transitions or provider calls,
  including when durable `evidence-closed` output already exists.
- AC-3: Unsupported versions and ambiguous, incomplete, or divergent run state
  fail actionably without mutating the run.
