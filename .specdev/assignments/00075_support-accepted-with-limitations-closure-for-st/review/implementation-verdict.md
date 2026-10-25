---
verdict: approved
material_divergence: false
scope_divergence: none
procedure_divergence: none
evidence_integrity: complete
user_reapproval_required: false
---

## Findings

No blocking findings. I made no changes to tracked files and ran no tests.

**Evidence check**
- The SHA-256 digests of the contract, plan, progress and outcome match `candidate-receipt.json` (contract `128a4611…`).
- I recomputed the candidate identity with a read-only call to `buildStandaloneAssignmentCandidateReceipt`. It returned `c9575830…76d8` with `completeness: complete` and no issues. That matches the receipt and `review/implementation-state.json`.
- The receipt lists 9 changed project paths. They match `git status` exactly: `package.json`, six `src/` files, the assignment guide template, and the new test.
- The three verification receipts are the three commands the contract authorized. All passed at `working-tree@1a4629e`, which is the starting boundary in `status.json`. No full suite was run.
- No external dependency was added or upgraded. `package.json` changes only `releaseDate` (now 2026-10-25) and test scripts.
- AC-1, AC-2 and AC-3 each have a final result of Passed in both the outcome and the receipt.

**How each acceptance criterion is met**
- **AC-1:**
  - `closeAcceptedAssignment` requires a durable written note and a preview, then an exact `--confirm` digest.
  - The digest covers the contract, the candidate receipt, the note text, the checkpoint, Attempts and file identities.
  - It refuses complete evidence, so normal delivery stays in charge of that case.
  - It records `disposition: accepted-with-limitations` and `verification: incomplete`, and the review is reported as not passed.
  - The test confirms preflight returns `acceptance_not_passed`, and that the contract, outcome, progress and worker result are kept byte-for-byte.
- **AC-2:**
  - It uses `abandonRun` and `clearCurrent` rather than editing checkpoints by hand, and marks dead Attempts as interrupted.
  - The commit uses `commitExactDelivery` with a closure-plan trailer, keeps unrelated workflow dirt out of the commit, and never pushes.
  - Interruptions at the artifact-write and focus-clear steps resume correctly. Retries after the commit return the same terminal commit, and an Adhoc start succeeds afterwards.
  - Both closing and closed records are blocked from implement, approve, checkpoint and reviewloop (through `assertCurrentAssignmentPath`), and from focus, shelf and unsupported close.
- **AC-3:** The new test covers:
  - a changed candidate, note or contract
  - a Mission child
  - an Attempt with no process marker, and one with a live process
  - focus on the wrong workflow
  - complete-evidence refusal

  The unsupported and shelf suites pass. The plan's "non-placeholder evidence" rule became "boundary plus `progress.json`". The outcome discloses this, and since nothing else creates `progress.json`, I don't count it as a divergence.

**Non-blocking observations**
1. **Retry can get stuck on unrelated changes.** At `src/commands/assignment-accepted-close.js:219` (used again at lines 301 and 417), the plan and the retained snapshot record identities for every dirty path in the repository, not just owned ones. If closure is interrupted and any unrelated dirty path then changes or appears (for example, concurrent Discussion notes), the retry stops with "Retained … changed" until that path is restored. Nothing is changed when this happens, but recovering is harder than it needs to be.
2. **An interrupted closure looks active.** `src/utils/assignment-lifecycle.js:35` does not recognise `closing`, so it is reported as `active` with next action `specdev next --json` instead of the retry instructions. Separately, `src/commands/focus.js:71` does not mark `closed` as immutable in listings.
3. **Error messages name the wrong outcome.** The reused `buildClosePlan` errors (`src/commands/assignment-close.js:226` and `:242`) mention "unsupported" when they come from the accepted-with-limitations path.
4. **Duplicate call.** At `src/commands/assignment-accepted-close.js:108`, `planClosure` is recomputed immediately after the identical call at line 94 in the same run. It could be simplified.
5. **Worse error when status is missing.** `src/utils/assignment-vnext.js:238` now reads `status.json` unconditionally, so a missing status file produces a raw ENOENT error instead of the earlier focus error.