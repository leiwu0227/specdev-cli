---
verdict: approved
material_divergence: false
---

## Findings

Candidate inspected via `git status` plus targeted reads of the untracked Assignment folder and the working-tree diff (`src/utils/artifact-retention.js`, `src/commands/assignment.js`, `src/commands/assignment-shelf.js`, `src/commands/mission.js`, `src/utils/assignment-delivery.js`, `tests/test-assignment-shelf.js`, `tests/test-vnext-foundations.js`). No full suite was run; existing receipts were reused.

Acceptance status — all three criteria have final results:
- AC-1: `node tests/test-assignment-shelf.js` (passed, 7138 ms) recreates a checkpoint-less residual run under the shelved Assignment's `run_id`, asserts idempotent shelf cleanup removes it, then recreates it and asserts `specdev assignment` creation preflight removes it before RippleGraph discovery.
- AC-2: `node tests/test-vnext-foundations.js` (passed, 3968 ms) asserts three refusals with residue preserved — non-terminal owner authority (`status: 'active'`), focused checkpoint-less run, and an Attempt recorded as running — plus the normal compaction result shape. The shelf fixture also asserts the running-Attempt refusal at command level.
- AC-3: both focused fixtures extend existing files and retain prior normal shelf/compaction assertions; `git diff --check` passed.

Contract conformance verified by reading the code, not only the receipts:
- The checkpoint-less branch is centralized in `compactTerminalWorkflowRuntime` (`artifact-retention.js:116-140`); `assertTerminalOwner` requires exactly one owner key matching the Attempt filter plus an allowed durable status, and rejects null/multi-key/mismatched authority. Normal checkpoint status validation, focus clearing, run removal, and Attempt cleanup are unchanged for runs that still have `checkpoint.json`.
- Every caller supplies authority from a state that is already proven terminal at that point: `assignment-delivery.js:139` gates on `status.status === 'completed'` before line 169; `mission.js:642` reads `mission.status` after `completeMission` sets `'completed'` (`mission.js:2266`); `assignment-shelf.js:180` passes the `'shelved'` status written at line 136 or the durable `'shelved'` record on the idempotent path (line 44).
- The preflight (`assignment.js:34-38`) sits ahead of all RippleGraph state/discovery work, as the contract's decision requires, and skips non-terminal owners rather than deleting. `--help` is intercepted in `dispatch.js:48` before the command runs, so help invocations have no cleanup side effects.

Receipt integrity: receipts are stamped `working-tree@dab4267`, which is current HEAD, and every changed source/test file has an mtime earlier than `progress.json`/`outcome.md` — the receipts describe the frozen candidate, with no post-verification source edits.

No dependency clause applies: `package.json` and lockfiles are untouched, so no registry/lockfile/audit evidence is owed. `package.json` `releaseDate` is already `2026-07-30`, satisfying the repository pre-commit instruction. The two modified tracked `.specdev` files (`.id-counters.json` bumping assignment 32→33, `.ripplegraph/current.json` focusing this Assignment's own run) are CLI-produced runtime state from executing this lifecycle, not product-source edits.

Non-blocking observations for the approval gate, both consistent with the approved contract:
1. Recovery scans only durable Assignment records. Checkpoint-less residue owned by a Mission still breaks `listRuns()` and would surface as a failure rather than a recovery. The contract scopes the preflight to "durable terminal Assignment records", so this is an accepted limitation, not a defect.
2. Compaction refuses on any Attempt whose record says `running`, without the `attemptLiveness` stale check the shelf command itself uses (`assignment-shelf.js:96-105`). A stale `running` record for a terminal Assignment therefore blocks both shelf finalization and new Assignment creation until the record is repaired. This is pre-existing compaction behavior and is strictly more conservative than AC-2 requires; the error names the offending Attempt ID, so it fails precisely and actionably.

No blocking contract defect remains.
