# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add a first-class resumable user-reapproval gate for Mission-owned Assignments whose reviewed candidate is substantively approved but exceeds automatic authority, with exact hash-bound approve/reject decisions, provider-free unchanged resume, and exhaustive parent routing for every valid nested disposition. The verified failure mode and OceanQuant reproduction are recorded in `project_notes/thoughts/2026-08-12_mission-child-user-reapproval-missing-edge.md`.

## Scope and non-goals

- In scope: review-result classification; a durable awaiting-user-reapproval lifecycle state; Mission status and semantic approve/reject commands; exact candidate/contract/findings/evidence binding; child completion or repair routing; exhaustive nested-result edges and validation; unchanged-candidate resume without provider work; installed graph migration/compatibility; help/guidance; and focused regression coverage.
- Non-goals: automatically accepting material divergence, weakening evidence or review requirements, reusing initial Mission approval as post-review consent, rewriting reviewer findings, special-casing OceanQuant state, approving changed candidates, or altering the separate evidence-only and successor-adoption semantics delivered by Assignment 00051.

## Expected behavior

When a Mission-owned child has a complete candidate and an otherwise approved implementation review with `user_reapproval_required: true`, SpecDev withholds delivery but records an authority pause rather than objective failure, repair, arbitration, or terminal child failure. The nested result returns deterministically to a Mission gate that displays the exact child, contract hash, candidate revision/digest, candidate-receipt identity, verdict/findings digest, disclosed divergences, and explicit approve/reject commands. Repeated status or run requests with unchanged identities return the same gate without launching another worker or reviewer.

Explicit approval of the displayed unchanged identity records a durable user decision, completes the child as approved-with-user-reapproval, integrates/checkpoints it once, and resumes normal Mission convergence while reusing existing evidence. Explicit rejection records the reason and routes to bounded repair or another existing user-selected terminal path without misclassifying the candidate as automatically approved. Any identity change makes the decision stale and requires a fresh preview.

## Important decisions

- Automatic-transition safety and semantic candidate quality are separate: required user authority pauses an approved candidate instead of converting it to objective failure.
- Post-review approval is a distinct semantic event bound to reviewed bytes and findings; it is never inferred from conversation or initial Mission approval.
- Every schema-valid nested terminal or paused disposition must match exactly one deterministic parent edge. A composition validator or equivalent focused invariant prevents future missing-edge regressions.
- An unchanged authority pause is a pure status/decision boundary and consumes no provider or verification budget.

## Constraints and invariants

- The pause is eligible only for a Mission-owned child whose review verdict is approved, evidence integrity and candidate receipt are complete, and the sole remaining automatic-transition blocker is explicit user reapproval. Genuine acceptance, evidence, infrastructure, or safety failures retain their existing semantics.
- Approval and rejection bind Mission ID, child ID, approved contract hash, reviewed candidate revision/digest and receipt identity, verdict path/findings digest, disclosed divergence taxonomy, actor, and timestamp. Changed source, receipt, contract, review, or findings invalidates the pending decision before mutation.
- Approval is idempotent: retry or restart integrates/checkpoints the same child at most once and creates no duplicate decision, transition, commit, worker, reviewer, or verification run.
- Parent routing is exhaustive and unambiguous for approved, approved-with-user-reapproval, awaiting-user-reapproval, repair/semantic failure, authority failure, infrastructure failure, and other supported nested results. No schema-valid child output may produce `has no matching edge`.
- Existing initial Mission approval, normal child success, genuine failure/gap resolution, evidence-only completed-with-follow-up, successor adoption, parallel waves, terminal handoff, review evidence integrity, and graph-package migration remain compatible.

## Delegated and reserved authority

- Delegated: choose concise disposition/node/command names, durable decision-artifact layout, exact graph migration mechanics, and rejection routing that preserve these semantics and existing contracts.
- Reserved for the user: approve the exact disclosed divergence, reject it with a reason, accept stale or mismatched identities, waive incomplete evidence, or expand post-review authority beyond the reviewed candidate.

## Risks and assumptions

- A pause introduced only in host code without compatible child and parent graph packages would reproduce the same composition failure under a new name.
- A decision bound only to Git revision is insufficient because review findings, receipts, or contract authority can change without the intended identity remaining equivalent.
- Resume logic must recognize the durable pause before automatic implementation/review dispatch or repeated `mission run` calls will amplify cost again.

## Verification authority

- Focused command-level and graph-composition tests may be proposed; every test command requires explicit user confirmation under repository instructions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: An otherwise approved, evidence-complete Mission child requiring user reapproval enters a durable awaiting-user-reapproval state with an exact identity-bound preview, does not deliver or become objective failure, and repeated status/run calls return that same gate with zero new provider or verification Attempts; ineligible or genuinely failed reviews retain their existing routes.
- AC-2: Approving the exact pending identity records an auditable user decision and idempotently completes/integrates/checkpoints the child once as approved-with-user-reapproval using existing evidence, while rejection routes to bounded follow-up; any changed contract, candidate, receipt, evidence, verdict, findings, or divergence identity refuses without mutation and presents a fresh decision boundary.
- AC-3: Installed Assignment and Mission graph packages plus their compatibility/migration path route every schema-valid nested disposition through exactly one parent edge, including the new pause and approved-with-user-reapproval outcomes, so focused end-to-end restart coverage advances normally and no valid output can raise `node child-assignment has no matching edge`.
