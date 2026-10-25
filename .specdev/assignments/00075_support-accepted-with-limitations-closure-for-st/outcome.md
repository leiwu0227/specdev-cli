# Outcome

## Delivered behavior

Standalone Assignments can preview and explicitly confirm accepted-with-limitations
closure before acceptance preflight can pass. The command preserves approved
contracts, failed evidence, review records, implementation, and runtime history.
It stops execution through the lifecycle API, clears matching focus, and publishes
an exact local terminal commit. Interrupted attempts resume from the confirmed plan;
terminal retries retain their commit and do not grant new review authority.

The preview includes the acceptance note, candidate and contract identities,
failed or missing evidence, existing review verdict, owned and excluded paths.
Complete acceptance evidence must continue through normal review and delivery.

## Deviations

None. The implementation uses the approved delegated eligibility decision:
an established implementation boundary and progress artifact are required.

Simplification checkpoint: reused the existing closure authority/ownership planner,
Attempt inspection, candidate receipt, and exact Git delivery helpers. Kept recovery
in one module with plain functions. No new classes, dependencies, or test-only
production branches. Runtime retention intentionally differs from unsupported
compaction, consistent with delivery_and_retention.md. No broader refactor needed.

## Unresolved risks

Explicit acceptance is a user decision; the CLI binds the written note and confirmed
candidate, and does not interpret natural-language consent. Active Adhoc guards still
apply to all Assignment commands; finish or cancel an Adhoc before a historical retry.
No remote publication, installation, or closure in another repository was performed.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | node tests/test-assignment-accepted-limitations.js: acceptance_not_passed, explicit preview/confirm, preserved contract and failed evidence, complete-evidence refusal. | Passed |
| AC-2 | Same isolated command: exact terminal commit, excluded dirt, retained history, Adhoc start, immutable guards, interrupted artifact/focus recovery, terminal retries. | Passed |
| AC-3 | Same isolated command: changed candidate/note/contract, wrong focus, Mission child, live/unknown Attempts; npm run test:assignment-unsupported and npm run test:assignment-shelf pass. | Passed |
