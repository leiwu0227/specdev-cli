# Assignment contract

Kind: bugfix

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Resolve durable Mission gap `gap-2d6c64c012c7d2ba` by matching verification
retry receipts on exact command and revision rather than free-text scope prose.
This is a delta under
`.specdev/missions/M00001_make-pinned-mission-graph-and-controller-version/brainstorm/contract.md`
at approved hash
`8f5844db8a82036c50e512ecdef69957bb6e53d1c2a93e1c17d0c87f1db04184`,
building on outcomes 00034, 00035, 00036, and 00037.

## Scope and non-goals

- In scope: narrow verification-receipt obligation identity and focused regression
  evidence for the same-command, same-revision retry case identified by Mission
  convergence review.
- Non-goals: changing receipt schemas or history, merging different commands or
  revisions, or weakening explicit follow-up and acceptance-outcome authority;
  all other Mission scope and non-goals are inherited unchanged.

## Expected behavior

A later passing receipt closes an earlier failed receipt when command and
revision match, even when their scope descriptions differ. Different commands
or revisions remain independent obligations, and all receipts retain their
original scope text and chronological history.

## Important decisions

Treat command plus revision as the stable verification obligation identity;
scope remains descriptive evidence because retry prose can legitimately explain
the repair and therefore is not an identity field.

## Constraints and invariants

Preserve receipt contents and ordering, and preserve the independent authority
of explicit `follow_up`, failed or blocked acceptance outcomes, and unrelated
verification obligations. Inherit all unchanged Mission constraints and
invariants.

## Delegated and reserved authority

- Delegated: the exact receipt-reduction implementation and focused fixtures
  consistent with this delta.
- Reserved for the user: all authority reserved by the Mission, including test
  execution approval, plus any broader redefinition of verification identity.

## Risks and assumptions

Assume exact command and revision identify one retryable obligation; if a single
command at one revision can represent distinct obligations, this narrow model
would conflate them. Outcomes 00034-00037 remain prerequisite evidence and are
not reopened by this child.

## Verification authority

Focused verification is limited to `npm run test:mission-compatibility` after
explicit user approval required by repository instructions; no broader suite is
authorized by this child.

## Acceptance criteria

- AC-1: For 00036's actual chronological failed-then-passed receipts with the
  same command and revision but different scope prose, verification follow-up
  is `none` while both receipts and their scope text remain intact.
- AC-2: A different command or revision, explicit follow-up requirement, or
  failed/blocked acceptance outcome still requires follow-up independently.
