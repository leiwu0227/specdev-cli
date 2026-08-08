# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Adhoc --adopt-dirty transactional by persisting the exact authorized path manifest, refusing protected concurrent-workflow paths before start, staging every adopted and Adhoc-owned path or none, verifying the committed and remaining path sets before reporting completion, and deriving receipts from the actual delivery commit

The authoritative live-test context is `.specdev/project_notes/thoughts/2026-08-08_oceanpower-assignment-discussion-adhoc-live-drag.md`, especially the partial adoption of Discussion D00002 artifacts.

## Scope and non-goals

- In scope: canonical dirty-path discovery; pre-start ownership and eligibility checks; a durable adoption manifest; exact staging and commit-set validation; failure-safe and idempotent finish recovery; post-commit owned-delta checks; and commit-derived human and JSON receipts for Adhoc `--adopt-dirty`.
- Non-goals: weakening concurrent callable ownership; automatically completing, cancelling, or mutating a Discussion or Test Audit; absorbing a changed Git HEAD; adopting paths outside the repository; allowing arbitrary path additions after approval without normal Adhoc ownership checks; or redesigning Assignment and Mission Git delivery.

## Expected behavior

When `specdev adhoc start ... --adopt-dirty` is requested, SpecDev resolves every current Git change to a canonical repository-relative file path without untracked-directory elision. It classifies the complete set before creating any Adhoc state. If an active callable owns any path, or any path is otherwise ineligible, start refuses the whole operation, identifies every rejected path and reason, and gives an actionable ownership resolution. If all paths are eligible, SpecDev persists the exact authorized manifest with the starting revision and status facts and displays that manifest in bounded human and JSON output.

At finish, SpecDev constructs the candidate from the persisted manifest plus the allowed Adhoc-owned delta. It stages in a failure-safe transaction, compares the staged set with the expected candidate, and creates no delivery commit unless every required path is represented and no unauthorized or protected path has entered the candidate. A failed finish keeps the Adhoc active and recoverable without silently changing the user's pre-existing index or worktree state.

After committing, SpecDev verifies the actual commit path set and the remaining owned worktree delta before reporting completion or clearing active state. Completion and recovery receipts are derived from Git and distinguish requested, committed, rejected, and remaining paths; prose supplied by the operator cannot overrule those facts.

## Important decisions

- The adoption authorization is an exact path manifest, not a count, directory prefix, prose summary, or silently filtered subset. Untracked directories are expanded to their file entries before authorization is recorded.
- Concurrent-callable protection is a precondition. An ineligible owned path makes start fail atomically; it is never removed from the requested set and hidden in another classification.
- The manifest records canonical repository-relative path identities, their starting Git status, the starting revision, and sufficient versioning to validate or migrate the artifact. File contents may change within the authorized Adhoc; the authority is over the recorded path set, not a frozen content digest.
- Finish may include paths created by the bounded Adhoc after start only when they pass the same ownership and safety classification. The manifest remains the required adopted subset and cannot shrink.
- Commit creation is preceded by an exact staged-set comparison. An error before commit restores or avoids changes to the caller's pre-existing index state and retains active Adhoc state.
- A recovered finish that finds an existing delivery commit must rerun the same manifest-versus-commit and remaining-delta checks before clearing state or returning `completed`.

## Constraints and invariants

- No requested dirty path may be silently omitted, including human-authored artifacts beneath an untracked directory.
- `completed` means every adopted path was represented in the verified delivery commit, no protected or unauthorized path was committed, and no pre-commit adopted delta remains dirty. Any ambiguity is blocking and includes the exact paths and recovery action.
- No delivery commit is created from a partial or over-broad staged set. Pre-existing index state and unrelated worktree content remain untouched on refusal or pre-commit failure.
- Path handling is repository-relative, traversal-safe, deterministic across human/JSON modes, and robust to spaces, renames, deletions, and untracked files.
- Receipt facts come from the persisted manifest, actual Git commit, and post-commit status. Operator outcome text is descriptive only.
- Existing non-adopting Adhoc behavior and HEAD-change refusal remain compatible unless the new invariant requires a clearer failure.

## Delegated and reserved authority

- Delegated: choose the manifest schema and versioning, temporary-index or equivalent transaction mechanism, path normalization and rename representation, output formatting, and compatibility treatment for active legacy Adhocs that lack an exact manifest, provided all observable invariants hold.
- Reserved for the user: resolve or release active callable ownership; decide whether previously dirty work should be adopted; authorize any broader path set after a refusal; resolve a changed HEAD; and authorize tests as required by repository instructions.

## Risks and assumptions

- Git porcelain can collapse untracked directories unless explicitly expanded; regression coverage must use multi-file untracked directories and path names that exercise parsing.
- Callable ownership can change between start and finish. Finish must revalidate protection and fail closed rather than relying only on the starting classification.
- Commit or process interruption can occur after staging or after Git creates the commit. Durable manifest state and commit trailers must make retry deterministic without duplicating or falsely completing delivery.
- Legacy active Adhocs may record only an adopted count. They must not be treated as having exact authorization; implementation may require an explicit safe recovery decision.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Starting with `--adopt-dirty` fully expands and persists the exact canonical path manifest. If any requested path is protected by an active concurrent callable or otherwise ineligible, no Adhoc state is created and human/JSON output lists every rejected path, its reason, and a safe next action; no requested path is silently filtered.
- AC-2: Finishing stages exactly the persisted adopted paths plus the valid Adhoc-owned delta and verifies that candidate before commit. A missing adopted path, injected unauthorized path, ownership change, staging failure, or interruption cannot produce a partial delivery reported as complete, cannot silently disturb the caller's prior index/worktree state, and leaves a deterministic retry path.
- AC-3: Fresh and recovered completion both verify the actual delivery commit and remaining owned worktree against the adoption manifest before clearing active state. The receipt reports requested, committed, rejected, and remaining paths from durable Git facts, and `completed` is impossible while an adopted pre-commit delta remains outside the commit.
