# Assignment contract

Kind: bugfix

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Treat later passing verification evidence as closing an earlier failed attempt
when the Mission controller classifies a completed child's follow-up need. This
is a resolution child for durable gap `gap-6a19ddeeb8fc6431`, sourced from
Assignment 00036's outcome at
`.specdev/assignments/00036_add-constrained-terminal-evidence-closure-recove/outcome.md`,
and follows completed prerequisite outcomes 00034, 00035, and 00036. It is a
delta under
`.specdev/missions/M00001_make-pinned-mission-graph-and-controller-version/brainstorm/contract.md`
at approved hash
`8f5844db8a82036c50e512ecdef69957bb6e53d1c2a93e1c17d0c87f1db04184`.

## Scope and non-goals

- In scope: child follow-up classification for chronological verification
  receipts where a later pass satisfies the same verification obligation as an
  earlier failed attempt.
- Non-goals: changing verification execution, rewriting historical receipts,
  or weakening explicit follow-up, failed acceptance, or blocked-outcome
  signals; all unchanged Mission scope and non-goals are inherited.

## Expected behavior

For each verification obligation, the latest applicable receipt determines
whether its earlier failure remains open. A later passing receipt closes that
failure, so a child with no other unresolved signal does not create a Mission
gap; a latest failure or any independent explicit failure signal still requires
follow-up.

## Important decisions

- Preserve verification history and derive closure by ordered evidence rather
  than deleting or rewriting the earlier failure.
- Apply precedence only to receipts for the same verification obligation so an
  unrelated pass cannot conceal a genuine failed check.

## Constraints and invariants

Inherit the Mission's constraints and invariants. In particular, this delta may
only correct child-gap classification; it must not reinterpret genuine
objective, authority, implementation, or verification failures or alter
durable receipt contents.

## Delegated and reserved authority

- Delegated: the exact stable identity used to match verification obligations
  and focused fixtures proving ordered receipt classification, within the
  Mission's existing delegated authority.
- Reserved for the user: all authority reserved by the Mission, including test
  execution approval and any expansion to other evidence or failure classes.

## Risks and assumptions

The 00036 progress evidence records the same command and revision failing, then
passing after fixture repair; matching that case too broadly could hide a
distinct failed scope. The prerequisite outcomes for 00034, 00035, and 00036
remain authoritative and otherwise unchanged.

## Verification authority

- Focused child follow-up classification cases and the Mission's integrated
  `npm run test:mission-compatibility` command may be run only with explicit
  user approval under repository instructions.
- Full suite authority remains inherited from the Mission and requires explicit
  user approval.

## Acceptance criteria

- AC-1: A failed verification receipt followed by a passing receipt for the
  same obligation produces no child follow-up or Mission gap when no other
  unresolved signal exists, while preserving both receipts.
- AC-2: A latest failed obligation, an unrelated later pass, or an independent
  explicit failed/blocked follow-up signal still produces required follow-up.
