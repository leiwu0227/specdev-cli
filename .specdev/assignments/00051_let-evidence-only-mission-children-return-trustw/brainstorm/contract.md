# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Let evidence-only Mission children return trustworthy negative observations as completed-with-follow-up, and add a fail-closed crash-safe transition that adopts a completed reviewed standalone successor into an active blocked Mission without rewriting historical evidence. The motivating incident and intended provenance model are recorded in `project_notes/thoughts/2026-08-11_mission-blocked-child-successor-adoption-gap.md`.

## Scope and non-goals

- In scope: explicitly classified evidence/verification-only Mission child results; parent gap and repair progression; a public read-only-plan/semantic-confirmation successor-adoption command; candidate, authority, review, receipt, and command-evidence validation; durable supersession provenance; nested graph recovery; idempotent journaling; status/history/help/guidance; and focused command-level coverage.
- Non-goals: waiving failed acceptance, allowing ordinary implementation children to claim observation completion, rewriting a blocked child's contract or receipt, importing arbitrary external work, changing terminal Mission handoff semantics, inheriting broadened authority or bypasses, or rerunning already-authoritative verification merely to adopt it.

## Expected behavior

An explicitly evidence-only Mission child succeeds at its authorized task when it executes the specified observation and records complete provenance, even if the command exposes a product defect. Its negative acceptance result remains visible and immutable, while a structured completed-with-follow-up disposition returns control to the Mission, opens or advances the corresponding gap, and permits a bounded repair child followed by fresh final verification. Ordinary implementation children cannot use this disposition.

For an already-stuck active Mission, `mission adopt-successor` (or an equivalent public semantic command) first performs a read-only planning pass that identifies the Mission, blocked child/gap, proposed standalone successor, candidate lineage, exact evidence being superseded and adopted, excluded dirt, and graph/artifact transitions. Explicit semantic confirmation applies only that unchanged plan. A valid adoption preserves the failed historical observation, links the reviewed successor and its authoritative current-candidate receipt as superseding convergence evidence, returns control from the nested child, and resumes or completes the Mission without launching another provider or verification command.

## Important decisions

- Child execution completion, observed command outcome, and parent Mission convergence are separate durable facts.
- Evidence-only completion never converts a failed command into passing acceptance; it says the authorized observation was completed and follow-up is required.
- Successor adoption is exceptional recovery, not normal Mission planning, and establishes an immutable content-addressed relationship instead of editing history.
- A bounded standalone successor remains a separate approval boundary; adoption reuses only authority and evidence that can be proven to satisfy the existing Mission candidate and command.

## Constraints and invariants

- Evidence-only behavior is available only from an explicit approved child classification and complete observation provenance. Objective, authority, or ordinary implementation failure remains blocking.
- Adoption requires an active Mission blocked inside its owned child; a terminal standalone successor with approved implementation review and complete delivery evidence; attributable repair authority; compatible candidate ancestry; and exact verification command, revision/digest, environment-policy, status, and cleanup identity.
- Missing or changed identities, substitute/filtered commands, relaxed assertions, bypasses, broadened scope, live or ambiguous work, and unrelated dirt fail closed without tracked mutation. Explicit operator authority is required when a legacy successor lacks durable predecessor provenance.
- The blocked child and failed receipt remain immutable. New records identify what supersedes them for convergence and preserve source/successor contract hashes, reviewed candidate identity, evidence hashes, delivery commit, operator authority, and graph-package identities.
- Preparation, graph transition, durable records, checkpointing, and runtime compaction form one journaled, idempotently recoverable transaction. Retry converges on the same result or explains the inconsistent boundary; it creates no duplicate receipt, transition, provider Attempt, verification run, or delivery commit.
- Existing successful Mission flow, genuine failure handling, terminal `mission handoff`, concurrent dirt ownership, and fresh approval boundaries remain compatible.

## Delegated and reserved authority

- Delegated: choose concise result/schema names, exact artifact layout, command spelling, and internal transaction boundaries that preserve these semantics and existing RippleGraph contracts.
- Reserved for the user: confirm an adoption plan; authorize legacy provenance substitution; accept any authority, candidate, command, evidence, review, or safety mismatch; and expand the capability beyond evidence-only children and proven standalone successors.

## Risks and assumptions

- Safely leaving a nested blocked child is a first-class graph transition, not an artifact-only edit; partial graph/artifact agreement could otherwise strand or falsely complete the Mission.
- Older incidents may lack explicit successor provenance, so operator authorization must be recorded without weakening all other identity and evidence checks.
- Similar command text is not evidence identity; candidate, environment, and cleanup provenance must remain machine-verifiable.

## Verification authority

- Focused command-level tests may be proposed; every test command requires explicit user confirmation under repository instructions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: An explicitly evidence-only Mission child that executes its one authorized observation and records complete provenance can terminate as completed-with-follow-up when the observation is negative; the failed result remains visible, control returns to the Mission, and the corresponding repair/final-verification path advances, while an ordinary implementation or incomplete-evidence child cannot use this result.
- AC-2: Successor adoption presents a mutation-free exact plan and refuses without tracked change for any ineligible lifecycle, missing authority/provenance, unreviewed or incomplete successor, candidate/contract/command/evidence/environment mismatch, bypass or broadened scope, live ambiguity, stale confirmation, or unrelated-path inclusion.
- AC-3: Confirmed valid adoption journaledly and idempotently preserves the blocked child and failed receipt, records content-addressed supersession by the reviewed standalone successor and its authoritative current-candidate evidence, transitions the nested graph back to the Mission, closes or advances the gap, produces coherent status/history/checkpoint state, preserves excluded dirt, and resumes or completes without rerunning a provider, test command, or delivery commit.
