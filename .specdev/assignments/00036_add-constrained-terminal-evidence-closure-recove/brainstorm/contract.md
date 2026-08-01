# Assignment contract

Kind: bugfix

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Complete the terminal-recovery delta authorized by
`.specdev/missions/M00001_make-pinned-mission-graph-and-controller-version/brainstorm/contract.md`
at approved hash
`8f5844db8a82036c50e512ecdef69957bb6e53d1c2a93e1c17d0c87f1db04184`,
building on prerequisite outcomes
`.specdev/assignments/00034_add-mission-compatibility-preflight-and-incompat/outcome.md`
and
`.specdev/assignments/00035_add-resumable-active-mission-migration-from-life/outcome.md`:
recover the one known terminal evidence-closure compatibility failure and close
the Mission with integrated regression evidence.

## Scope and non-goals

- In scope: exact-signature terminal recovery through the supported migration
  path, restoration of its positively evidenced gap, continuation to normal
  completion/landing, and integrated compatibility regression coverage.
- All unchanged scope constraints and non-goals are inherited from the approved
  Mission; this child adds no other terminal failure class or migration version.

## Expected behavior

A terminal Mission is recoverable only when its recorded failure, referenced
gap, and durable positive closure evidence match the Mission-authorized
historical compatibility case. Recovery reuses the delivered resumable
migration, preserves successful verification/checkpoint evidence, restores the
gap to `evidence-closed`, and permits normal completion without a provider
rerun; every non-matching case remains unchanged with actionable diagnostics.

## Important decisions

- Extend the explicit `specdev mission migrate <id>` path with a narrowly
  validated terminal candidate rather than introduce broad Mission
  resurrection or manual state repair.
- Treat failure signature, gap identity, and positive closure evidence as a
  single recovery predicate; partial matches are insufficient.

## Constraints and invariants

All unchanged Mission constraints and invariants are inherited. In particular,
recovery must use the existing journaled migration guarantees, must not create
provider Attempts or duplicate transitions, and may mutate terminal state only
after the complete recovery predicate is proven.

## Delegated and reserved authority

- Delegated: the exact recovery-signature encoding, reconstruction mechanics,
  diagnostics, and focused fixtures within the approved Mission behavior.
- Reserved for the user: all authority reserved by the approved Mission,
  including expansion to other failure classes or graph versions and test
  execution approval; no additional authority is delegated here.

## Risks and assumptions

Historical records may be incomplete or superficially resemble the known
fallback; such ambiguity must fail closed. This child assumes outcomes 00034
and 00035 provide the compatibility classification and resumable in-place
migration primitives they report.

## Verification authority

- Focused authority is limited to the terminal-recovery cases and the Mission's
  integrated `npm run test:mission-compatibility` command; execution requires
  explicit user approval under repository instructions.
- Full-suite authority is unchanged from the approved Mission and is outside
  this child.

## Acceptance criteria

- AC-1: An exact historical evidence-closure fallback with matching gap identity
  and durable positive closure evidence migrates and resumes through normal
  completion/landing while retaining prior final-verification and checkpoint
  evidence and launching no provider.
- AC-2: Genuine terminal failures and any missing, ambiguous, or mismatched
  signature, gap, or closure evidence are rejected without run mutation and
  with actionable diagnostics.
- AC-3: The focused Mission compatibility verification passes as one integrated
  regression covering preflight, active migration, terminal recovery, and the
  compatible direct `1.4.0` path.
