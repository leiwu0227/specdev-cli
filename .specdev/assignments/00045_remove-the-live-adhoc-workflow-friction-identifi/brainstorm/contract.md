# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Remove the live Adhoc workflow friction identified in the Fireplace field note by making dirty-path decisions explicit, providing stable launcher guidance, capturing verification structurally, expanding finish handoff output, generating readable subjects, and defining phase-level announcements without weakening atomic delivery

## Scope and non-goals

- In scope: the Adhoc CLI lifecycle and installed/generated workflow guidance needed to address all seven improvement areas in `.specdev/project_notes/thoughts/2026-08-06_fireplace-live-adhoc-workflow-friction.md`: worktree classification, launcher resolution, structured verification capture, finish reporting, readable subjects, announcement granularity, and the repeated-run operator loop.
- Non-goals: a rolling or multi-change Adhoc, a new workflow lane, weakening the one-scope/one-delivery-commit boundary, changing Assignment or Mission semantics, or automatically running verification that the repository/user has not authorized.

## Expected behavior

Adhoc start and finish explain which dirty paths are product changes versus independent SpecDev callable state, what policy was applied, and whether the operation may proceed. Generated instructions provide one copyable launcher-resolution contract that chooses an executable workspace launcher when present and otherwise uses the supported PATH command without first attempting a missing path. An optional Adhoc verification command records bounded command evidence—including failed attempts and passing reruns—while the existing human `--verification` path remains supported. Finish emits a handoff-ready human and JSON result containing the delivery commit/subject, committed paths, verification results, remaining classified paths, and product-tree cleanliness. Default subjects end at a readable word or clause boundary, with an optional short title available independently of the full scope. Installed guidance asks for announcements at meaningful phase boundaries or plan changes rather than before every repeated read-only probe.

## Important decisions

- Independent Discussion and Test Audit artifacts are valid concurrent workflow state: classify and preserve them outside Adhoc ownership rather than treating them as product dirt or silently hiding them.
- Structured verification is additive. `adhoc verify --label="..." -- <command>` records command, working directory, timing, exit status, bounded output/result, tested revision, and an optional annotation. Finish retains the complete attempt history, distinguishes superseded failures from current passing acceptance evidence, and may finish with an outcome plus recorded passing evidence; legacy `--verification="..."` remains valid.
- Human-readable output and `--json` expose the same material decisions. Output field names and persisted evidence use versioned, stable structures suitable for agent consumption.
- Optimize consecutive Adhocs by making each finish self-contained; do not retain scope across runs or combine deliveries.

## Constraints and invariants

- Adhoc continues to own exactly one bounded product change, one durable receipt, and one final delivery commit, and must not stage or commit independent concurrent callable artifacts.
- Dirty product changes still require inspection, a separate checkpoint, or explicit `--adopt-dirty`; classifying workflow state must not create a bypass for product changes.
- Verification execution is explicit and remains subject to repository-specific approval rules. Output capture must be bounded and must not place transient/raw process data in tracked product paths.
- Existing Adhoc invocations and receipts remain readable and supported, including `finish --outcome --verification` and recovery after a delivery commit was created before active state was cleared.

## Delegated and reserved authority

- Delegated: choose internal helpers, evidence storage details under ignored SpecDev cache/runtime state, exact output formatting, subject-boundary heuristics, and focused regression coverage needed to satisfy this contract.
- Reserved for the user: any new workflow lane, relaxation of dirty-tree or atomic-delivery safety, incompatible CLI/receipt changes, running tests, or expansion beyond the Adhoc and generated-guidance surfaces described here.

## Risks and assumptions

The main risks are incorrectly classifying a product path as ignorable workflow state, leaking or overgrowing captured command output, and making finish unrecoverable after the commit boundary. The implementation should reuse the existing concurrent-callable ownership policy and delivery recovery mechanisms. The field note is assumed to be the authoritative problem statement; implementation-level choices may vary where it offered alternatives, provided every observable outcome above is met.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: With concurrent Discussion/Test Audit artifacts and optional product changes present, Adhoc start and finish return equivalent human/JSON classifications for product dirt, preserved workflow state, adopted paths, applied policy, and allow/block decision; product dirt still blocks without explicit adoption, and preserved workflow artifacts never enter the delivery commit.
- AC-2: Generated workflow/skill guidance resolves an executable workspace launcher or PATH fallback through one documented, copyable mechanism without an expected ENOENT attempt, and defines announcements at meaningful phase transitions while preserving visibility for blockers and plan changes.
- AC-3: An Adhoc can record labeled verification commands with bounded structured evidence, retain a failed attempt followed by its passing rerun, and finish from current passing evidence plus an outcome; legacy manually summarized verification remains supported and the receipt clearly distinguishes attempt history from acceptance evidence.
- AC-4: Successful and recovered finish paths provide a handoff-ready human/JSON result with scope, receipt, final commit and readable subject, committed product/receipt paths, verification labels/results, start/end revisions, remaining paths by classification, and an explicit product-worktree-clean result.
- AC-5: Long scopes generate understandable word- or clause-bounded commit subjects, an optional short title can control the subject without replacing full receipt scope, and consecutive Adhocs remain separate one-scope/one-commit deliveries without manual Git archaeology between runs.
