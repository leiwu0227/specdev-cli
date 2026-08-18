# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make the fast path for small, user-requested documentation artifacts immediate
and unambiguous while preserving SpecDev's governed workflows for product
changes. This addresses the workflow drag recorded in
`.specdev/project_notes/thoughts/2026-08-18_small-documentation-write-workflow-drag.md`.

## Scope and non-goals

- In scope: align the product-owned dispatcher guidance, generated adapter and
  skill prose, workflow guide, public summary, and focused regression coverage
  around Direct documentation writes, explicitly selected Adhoc work,
  proportional orientation, auxiliary cross-repository notes, and meaningful
  phase announcements.
- Non-goals: introduce a new workflow lane or graph, weaken Adhoc's receipt and
  delivery-commit guarantees, change product/runtime behavior outside task
  classification and agent guidance, or rewrite installed `.specdev/` state.

## Expected behavior

Small, non-product documentation artifacts requested by the user are Direct:
the agent announces once, reads only destination instructions and narrowly
necessary facts, writes and checks the artifact, and creates no graph, receipt,
or automatic commit. Adhoc remains available only when the user explicitly
selects it and retains its existing governance. Current-repository manuals,
thought notes, cross-repository handoff notes, and explicit Adhoc documentation
requests are distinguished with concrete examples. Announcement guidance is
consistently phrased around meaningful phases rather than individual probes.

## Important decisions

- Expand Direct rather than add a separate `Direct Write` lane, keeping the
  taxonomy small.
- Make explicit user selection visible in the Adhoc skill description and
  top-level classifier before skill activation.
- Apply a "write first, verify narrowly" orientation budget to low-risk
  documentation, without relaxing orientation for governed product work.
- Keep templates and generator code as the policy sources of truth. Synchronize
  repository-tracked `.claude`/`.codex` host skill copies as generated outputs
  when their canonical wording changes; do not independently author policy in
  those copies or rewrite installed `.specdev/` workflow files.

## Constraints and invariants

- Existing Assignment, Mission, and Adhoc approval, evidence, receipt, and
  commit semantics remain unchanged.
- Documentation that changes product behavior, public contracts, or governed
  workflow state does not qualify for the Direct-write fast path merely because
  its file format is Markdown.
- Repository-specific instructions and explicit user workflow selections take
  precedence.
- Before any test command, obtain the user's explicit approval as required by
  this repository's instructions.

## Delegated and reserved authority

- Delegated: choose the smallest coherent source/template/docs/test edits that
  satisfy the contract and update `package.json`'s `releaseDate` before the
  Assignment's delivery commit.
- Reserved for the user: contract approval, any scope expansion, permission to
  run focused or full tests, and any change to the selected workflow lane.

## Risks and assumptions

- Agent hosts may consume generated adapters, tracked host skill copies, or
  installed skill catalogs; focused coverage must assert that canonical policy
  sources generate or synchronize the host-visible wording rather than allowing
  independent copies to drift.
- Overly broad Direct wording could accidentally exempt behavioral changes, so
  eligibility is defined by artifact impact rather than extension alone.

## Verification authority

- Focused tests for changed modules: require explicit user approval before use.
- Full suite: requires separate explicit user approval and should run only if
  narrower evidence cannot establish the acceptance criteria.

## Acceptance criteria

- AC-1: Product-generated guidance classifies small user-requested,
  non-behavioral documentation artifacts as Direct with no workflow state,
  receipt, or automatic commit, and includes current-repository manual and
  cross-repository handoff examples plus the narrow orientation rule.
- AC-2: Adhoc is visibly user-explicit before activation, retains its existing
  governed semantics, and an explicit Adhoc documentation example remains
  routed to it.
- AC-3: Announcement language is consistently based on meaningful phases, and
  focused regression coverage detects drift in the classification, examples,
  generated skill/adapter wording, and repository-tracked host skill copies.
