# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Assignment finalization evidence-safe and operationally legible by preflighting complete delivery receipts before review and commit, enforcing the outcome artifact contract, surfacing bounded semantic progress milestones, separating harness qualification from authoritative acceptance runs, and clarifying divergence semantics

## Scope and non-goals

- In scope: the standalone Assignment worker-artifact, implementation-review, delivery-receipt, commit/finalization, Attempt-progress, verification-evidence, and reviewer-result contracts needed to address `.specdev/project_notes/thoughts/2026-08-08_assignment-delivery-receipt-and-live-progress-drag.md`.
- Non-goals: changing Mission delivery semantics, interpreting or exposing chain-of-thought, dumping raw provider logs, automatically expanding verification authority, repairing historical Assignment commits, or changing product/data behavior in repositories using SpecDev.

## Expected behavior

Standalone Assignment artifacts are schema-checked and used to build a complete candidate receipt before implementation review can approve or any delivery commit can be created. Review receives the candidate receipt identity; reviewed bytes and receipt inputs are revalidated immediately before one atomic delivery commit and a complete final receipt. Incomplete evidence returns a focused, reusable artifact-repair state and is never rendered as completed. New Assignments receive and workers are instructed with the canonical outcome structure. Foreground progress preserves a bounded, secret-safe semantic milestone derived from explicit telemetry or the latest public `Specdev:` announcement and reports useful task/command/evidence context without exposing reasoning. Verification receipts distinguish harness qualification from authoritative acceptance evidence. Reviewer results explain scope and procedural divergence, evidence integrity, and whether user reapproval is required while remaining able to read existing verdicts.

## Important decisions

- Candidate-receipt completeness excludes fields that can exist only after commit, but includes every contract, artifact, acceptance, verification, risk, and review-input invariant needed to authorize review. The final receipt adds and validates the commit boundary without weakening the candidate gate.
- Canonical `outcome.md` contains `# Outcome`, `## Delivered behavior`, `## Deviations`, `## Unresolved risks`, and the three-column acceptance table. New work is strict; legacy inline `Unresolved risks:` may be parsed only through an explicit compatibility path and must produce the same normalized risk result.
- Artifact failures reuse the existing worker result and current source changes through a bounded repair continuation. They do not create a delivery commit, declare lifecycle completion, or launch a new broad worker unless the user explicitly requests retry.
- Public progress prefers a valid explicit milestone, otherwise a sanitized bounded `Specdev:` announcement. The last safe milestone survives quiet/stale liveness and is accompanied, when available, by current Task ID, active command/wait state, last meaningful activity time, and passed/failed verification counts.
- Verification evidence records an explicit role (`qualification` or `authoritative_acceptance`); the receipt reports both counts and identifies the authoritative evidence. Qualification failure does not consume an authoritative-run allowance, while a genuine authoritative failure remains retained acceptance evidence.
- The reviewer envelope gains a structured divergence taxonomy while preserving the legacy `material_divergence` projection for compatibility. Scope/authority divergence or `user_reapproval_required: true` cannot silently transition to delivery; disclosed procedure divergence with preserved evidence may still be approved.

## Constraints and invariants

- No `SpecDev-Assignment` delivery commit exists until candidate evidence is complete, the required review or policy waiver is valid for the exact candidate identity, and the reviewed delivery inputs remain unchanged.
- Exactly one final standalone Assignment delivery commit is created, terminal runtime compaction occurs only after successful evidence-safe finalization, and recovery is idempotent across interruption boundaries.
- `Assignment complete` and equivalent JSON lifecycle status are emitted only with a complete final receipt; incomplete evidence emits an actionable nonterminal repair state and issue list.
- Progress and receipt data are bounded, versioned, secret-safe, deterministic enough for tests, and backward-compatible with existing persisted Assignments, verification receipts, and reviewer verdicts.
- Repository confirmation rules and approved verification authority continue to govern every executed command; evidence classification must not authorize or rerun commands by itself.

## Delegated and reserved authority

- Delegated: choose candidate-receipt representation and identity digest, focused repair-node integration, compatibility normalization, safe announcement extraction, progress field names, and exact structured taxonomy encoding consistent with these behaviors.
- Reserved for the user: broader workflow/lane changes, Mission behavior changes, relaxing evidence or Git-boundary safety, incompatible removal of legacy fields, executing repository tests, or expanding an Assignment's approved operational authority.

## Risks and assumptions

The main risks are committing after review against changed bytes, treating a legacy artifact as complete under weaker rules, leaking provider output through progress extraction, and making old terminal Assignments unreadable. Candidate identity must cover every reviewed receipt input, semantic extraction must fail closed while retaining the last valid milestone, and compatibility parsing must be explicit and fixture-backed. The source note is assumed authoritative for the observed OceanQuant failure and desired operator experience.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Missing or invalid outcome/risk/acceptance/verification evidence produces a candidate-receipt preflight failure before review and before any delivery commit, returns a focused reusable artifact-repair action, and can resume from repaired artifacts without a replacement worker; complete evidence yields exactly one commit and one unambiguous completed state.
- AC-2: New Assignment execution supplies the canonical outcome skeleton and validates its exact required structure; canonical risk sections normalize `none` versus present nonblocking caveats, and any supported legacy inline form has explicit compatibility fixtures and the same receipt semantics.
- AC-3: Required review receives a complete candidate-receipt summary and identity, mutation of any reviewed receipt input invalidates that review before commit, and human/JSON terminal output never combines incomplete evidence with Assignment completion.
- AC-4: A bounded safe worker `Specdev:` announcement becomes visible as semantic progress when no newer explicit milestone exists, remains visible through quiet/stale intervals, and progress reports available task, active-command/wait, activity-time, and verification-count context without secrets, source excerpts, or unbounded provider output.
- AC-5: Verification records and final receipts separately count harness qualification and authoritative acceptance runs and identify the authoritative evidence; reviewer output exposes scope divergence, procedure divergence, evidence integrity, and user-reapproval requirement while legacy `material_divergence` verdicts remain readable and transition safety is preserved.
