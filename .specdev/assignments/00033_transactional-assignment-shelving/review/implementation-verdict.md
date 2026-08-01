---
verdict: approved
material_divergence: false
---

## Findings

Scope reviewed: untracked candidate artifacts under `.specdev/assignments/00033_transactional-assignment-shelving/` plus the working-tree diff (`src/commands/assignment-shelf.js`, `src/commands/assignment.js`, `src/commands/dispatch.js`, `src/utils/git-delivery.js`, `tests/test-assignment-shelf.js`, `package.json`).

**Dependencies:** none added or upgraded. The `package.json` diff is solely `releaseDate` `2026-07-30` → `2026-08-01`, which also satisfies the CLAUDE.md pre-commit requirement. No registry/lockfile/advisory evidence is required for this candidate.

**Receipts:** all three receipts in `implementation/progress.json` are bound to `working-tree@453724f7…`, which matches current `HEAD` and the inspected working tree. `npm run test:assignment-shelf` exists (`package.json:27`) and is recorded as passed. No suite was rerun.

**Acceptance criteria — each has a final result and matching evidence:**

- AC-1: `snapshotToken()` (`src/commands/assignment-shelf.js:421`) derives a 16-hex SHA-256 value over Assignment ID, `HEAD`, and the sorted post-cache-classification path set; `parseSnapshotToken` rejects malformed input; `establishGitBoundary:274-297` validates at preflight and `assertUnchangedShelfState:460` revalidates immediately before staging and again before the commit. Because `gitDirtyPaths` reads `git status --porcelain=v1 -z` path fields irrespective of stage state, staged/unstaged movement does not invalidate the token — exercised by the dirty case, which runs `git add work.txt` between the decision and the retry. Fixtures cover both rejection modes (added path, advanced `HEAD`) and assert the pasted array is gone (`tests/test-assignment-shelf.js:212`).
- AC-2: clean-head, dirty snapshot, cache-only, and legacy tracked-cache cases each assert boundary commit identity, trailer text on both commits, preserved local cache content, `git ls-files .specdev/cache` empty after retirement, and `git status --short` empty. `assertTerminalIndexSafe:586` bounds the terminal commit to owned paths plus cache retirement, so unrelated staged work cannot be swept in.
- AC-3: boundary recovery asserts exactly one snapshot commit after a rerun (trailer discovery short-circuits, `establishGitBoundary:252-265`); terminal recovery drives a real failure through a `pre-commit` hook, confirms `status.json` reaches `shelved`, then confirms the rerun returns `idempotent: true` with a trailer-bearing terminal commit and a clean status. Help is served before `resolveTargetDir`/`requireSpecdevDirectory` (`src/commands/assignment.js:28-30`), and the fixture asserts `status.json` is byte-identical across the help invocation.

**Divergence:** none. The delivered behavior, the design plan's T-1/T-2/T-3, and the approved contract agree; `outcome.md` records no deviations. The brainstorm verdict's one non-blocking clarification — precedence between trailer discovery and token revalidation — is resolved in the implementation exactly as suggested, with trailer discovery short-circuiting.

**Non-blocking observations (no change requested):**

- `findCommitWithTrailers` runs `git log HEAD` at `establishGitBoundary:252`, before the `if (!initial.head)` guard at `:268`. In a repository with zero commits the user now sees raw git stderr instead of "Shelving requires a repository with an existing Git commit". Cosmetic, and unreachable for any Assignment that has a committed lifecycle.
- Narrow edge case: if an authorized path has staged content differing from `HEAD` while its worktree content equals `HEAD`, the `git add -A` at `:312` collapses it to clean, the path leaves the dirty set, and the subsequent `assertUnchangedShelfState` aborts. The abort is non-destructive and the rerun succeeds; the contract's risk note ("The retry snapshots that path's current content") already covers this authority model.
- `.specdev/.current` typed focus is not cleared by shelving. RippleGraph focus (`current.json` `focusedRunId`) *is* cleared and staged, so the contract's focus invariant is met in the RippleGraph sense. The typed-focus gap is pre-existing (unchanged by this diff) and adjacent to the explicitly deferred `specdev next` reconciliation non-goal.

No blocking contract defect remains.
