# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Prevent SpecDev guidance from treating an explicitly requested coordination or handoff note written from the active repo into another repo as an implicit Adhoc change. Preserve explicit lane selection and make the repository ownership boundary clear to coding agents.

## Scope and non-goals

- In scope: generated and templated workflow guidance, platform-adapter wording, the Adhoc skill's trigger boundary, destination-repository guidance, and regression coverage for installed instructions.
- Non-goals: changing Adhoc transaction mechanics, automatically detecting repository intent at runtime, exempting cross-repository product/code changes, or treating unrequested external writes as authorized.

## Expected behavior

While operating in repo A, a coding agent that is explicitly asked to save a bounded coordination or handoff note in repo B writes only that note without creating Adhoc or other SpecDev state in repo A and without re-anchoring merely because the destination is a repository. The agent still respects destination instructions and reports the write normally.

If the requested work changes repo B's product, runtime, or workflow state, or the user explicitly requests SpecDev governance there, the agent re-anchors in repo B and lets the user select the appropriate repo-B lane. Ordinary current-repository edits keep their existing classification behavior.

## Important decisions

- A user selecting a bounded file write is not the same as selecting the Adhoc lane; lane selection must be explicit.
- The exemption is semantic and narrow: coordination notes are auxiliary handoff artifacts, not governed repository delivery.
- Installed instructions must explain both halves of the boundary so agents neither start Adhoc in repo A nor silently exempt actual repo-B implementation work.

## Constraints and invariants

- Source templates and installer-generated skills/adapters remain authoritative; this change does not directly edit installed `.specdev/` runtime state.
- Existing Direct, Adhoc, Assignment, Discussion, Test Audit, and Mission behavior remains compatible for work owned by the active repository.
- The guidance must remain consistent across supported coding-agent adapters and must not rely on one provider's implicit skill-trigger behavior.

## Delegated and reserved authority

- Delegated: refine concise wording across authoritative templates, generated skills/adapters, and focused installation assertions while preserving the boundary above.
- Reserved for the user: expanding the exemption beyond explicit coordination/handoff artifacts or changing when repository product work requires a SpecDev lane.

## Risks and assumptions

- "Handoff note" can be confused with a durable product artifact; guidance must distinguish the artifact's coordination purpose from its file extension or destination path.
- Destination repositories may have their own instructions, which remain applicable even when no SpecDev lane is created solely for the note.

## Verification authority

- Focused tests for changed installation guidance may be proposed; execution requires explicit user confirmation under repository instructions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: Authoritative workflow and Adhoc-skill guidance consistently states that an explicitly requested cross-repository coordination/handoff note does not implicitly select Adhoc or create current-repository SpecDev state, while actual destination-repository implementation or explicitly governed work must be classified after re-anchoring there.
- AC-2: Focused installation regression coverage proves that newly initialized supported-agent instructions preserve the explicit-lane and repository-ownership boundary, including the handoff-note exemption, without weakening existing Adhoc ownership and transaction guidance.
