# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Complete Assignment candidate preflight before review so incomplete candidates remain with their frozen implementation owner, full evidence determines completeness, and no review state or Attempt is created prematurely.

The approved target is `.specdev/project_notes/roadmap/designs/workflow/lanes/assignment/assignment_candidate_preflight.md`. Assignment `00046_make-assignment-finalization-evidence-safe-and-o` established the current candidate receipt and defensive identity checks; this change moves complete reviewability validation to the implementation boundary without weakening those later defenses.

## Scope and non-goals

- In scope: the authoritative verification projection, candidate-receipt construction, pre-review transition, owner-preserving repair response, and the review, waiver, recovery, and delivery consumers that must share the same candidate interpretation.
- Non-goals: changing contract approval, verification authority, reviewer independence, Mission orchestration, execution-mode selection, review convergence policy, or terminal delivery semantics.

## Expected behavior

Before an Assignment crosses from implementation into implementation review, SpecDev evaluates the complete implementation artifacts and chronological verification ledger. A bounded receipt may summarize that ledger, but preview limits never determine completeness.

An incomplete candidate remains at implementation and returns bounded repair obligations to the frozen implementation owner. It creates no reviewer Attempt, verdict, review state or round, and consumes no review artifact-repair allowance. After repair, the same preflight is rerun. A complete candidate advances normally, and review, waiver, recovery, and delivery defensively revalidate the same authoritative candidate identity.

## Important decisions

- Later evidence may supersede an earlier failed or skipped obligation only when it represents the same authority and candidate context; qualification evidence cannot satisfy authoritative acceptance evidence.
- Chronological evidence remains durable even when the effective current obligations and displayed preview are bounded.
- Preflight is shared by required-review and waiver paths and behaves consistently for inline and spawned implementation ownership.

## Constraints and invariants

- Preserve existing candidate-identity checks at review and final delivery.
- Preserve historical receipt readability and avoid making bounded display fields authoritative.
- Do not create a new executor or transfer repair ownership during failed preflight.
- Keep Mission behavior unchanged except where shared pure candidate or evidence projections require compatibility.
- Repository instructions remain authoritative, including explicit user confirmation before any test command.

## Delegated and reserved authority

- Delegated: choose the internal source boundaries, additive receipt representation, exact repair payload, and focused regression coverage needed to satisfy this contract while preserving current public command semantics.
- Reserved for the user: any scope expansion, compatibility break, change to evidence authority or review policy, Mission lifecycle change, or weakening of approval, review, and delivery gates.

## Risks and assumptions

Moving validation earlier can expose recovery paths that previously relied on review-owned artifact repair. The implementation must preserve resumability for both execution modes and distinguish authoritative completeness from bounded presentation without discarding evidence history.

## Verification authority

- Focused tests for changed modules require explicit user confirmation before execution.
- The full suite requires separate explicit user approval.

## Acceptance criteria

- AC-1: Candidate completeness is derived from the full chronological verification ledger. Bounded previews cannot hide an unresolved authoritative failure, skip, or missing obligation; qualification evidence cannot satisfy authoritative acceptance, and only later evidence for the same authority and candidate context may satisfy an earlier obligation.
- AC-2: Required-review and waiver paths run candidate preflight before entering review. An incomplete candidate remains at implementation, returns repair to the frozen inline or spawned owner, and creates no reviewer Attempt, verdict, review state, review round, or review artifact-repair consumption; a repaired candidate can rerun preflight and advance.
- AC-3: A complete candidate advances with one authoritative identity that review, waiver, recovery, and delivery defensively revalidate, while historical receipts remain readable and existing Mission consumers retain their current orchestration semantics.
