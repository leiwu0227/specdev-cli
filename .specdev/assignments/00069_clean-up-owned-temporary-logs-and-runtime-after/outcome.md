# Outcome

## Delivered behavior

Successful Assignment, Discussion, and Mission completion removes owned logs, provider results, retired transient artifacts, and temporary runtime after preserving useful records. Explicit cancellation and Mission abandonment also clean owned terminal cache; shelved and recoverable work retain diagnostics. Cache deletion precedes Attempt removal so errors preserve retry ownership. Completed Mission child runs are compacted with their parent, and completed Mission retries reattempt compaction.

Discussions retain a compact completion/activity record used by listing, inspection, knowledge retrieval, and Assignment/Mission promotion. New retired scratch files are grouped under their explicit owner. `specdev cleanup [--apply] [--json]` previews eligible paths and reclaimable bytes, reports skipped candidates, revalidates authority and files on apply, and reports partial failures. Cleanup preserves unknown ownership, live/uncertain Attempts, shared caches, durable evidence, concurrent workflows, and symlink/path-escape candidates.

The user explicitly approved the four focused commands. All passed after correcting a test variable collision and preserving the pre-existing cancellation convenience pointer behavior. The full suite was not run. Installed workflow files were not updated, and cleanup was not applied to the user's accumulated workspace logs. `package.json` releaseDate is already the current date, 2026-09-17.

## Deviations

None.

## Unresolved risks

Legacy logs whose Attempt records have already been removed may remain because ownership cannot be proven; cleanup reports them for inspection as specified in the contract.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Approved foundations, engine integration, Mission abandonment, and Assignment shelf suites verify terminal cleanup and retained workflow behavior. | Passed |
| AC-2 | Foundations fixtures verify preview bytes, apply/repeat, partial deletion with retained ownership and retry; engine integration verifies the public cleanup command. | Passed |
| AC-3 | Foundations fixtures cover live/running/uncertain Attempts, shelved and active cache, unknown legacy files, shared caches, symlink leaves/ancestors and traversal. Integration preserves concurrent Discussion runtime and promotion; shelf/abandonment suites preserve historical invariants. | Passed |
