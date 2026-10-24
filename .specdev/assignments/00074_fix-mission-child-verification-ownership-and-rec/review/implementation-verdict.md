---
verdict: approved
material_divergence: false
scope_divergence: none
procedure_divergence: none
evidence_integrity: complete
user_reapproval_required: false
---

## Findings

No blocking findings. The repaired candidate fixes the prior blocking finding, and I found no regression from the repair.

### Prior findings re-checked

**1. Blocking: existing approved single-child Missions could get stuck. Resolved.**
- `declaredVerificationOwnership` now takes a `legacyApproved` option (`src/utils/mission-verification-boundary.js:44-48`). With it set, a parent contract that has no `## Verification ownership` heading keeps the old behavior: the child owns every criterion and the controller owns none. It does not guess ownership from the contract text.
- Only child derivation passes this option (`src/commands/mission.js:1401`). Derivation runs only after the Mission is approved.
- New approvals still require an explicit declaration (`src/commands/mission.js:624`). So a new Mission cannot reach the fallback by leaving the section out.
- The deadlock in older Missions is not ignored. If such a child hits the verification-order cycle, the confirmed recovery command can still separate the boundary. The README and workflow guide now say so.

**2. The tests hid the regression. Resolved.**
- `tests/test-mission-compatibility.js` is no longer changed, so its legacy fixtures look like real pre-upgrade contracts again.
- The authorized regression `tests/test-mission-verification-boundary.js:79-118` now:
  - starts from a contract with no declaration;
  - checks that a new `--approve` is refused with `/explicit/`;
  - simulates an approval from before the upgrade through the `decideGuidedNode` lifecycle API, without editing checkpoints;
  - resumes with `--inline`, derives the child with full-scope acceptance, recovers, and completes the Mission only after the final command passes.
- The failing-final-command and fresh-Mission cases remain.

**3. Non-blocking: retrying after the mapping file was deleted. Resolved.**
- When recovery is already applied and the mapping file is missing, the code treats that as absent instead of failing (`mission-verification-boundary.js:221-234`).
- A retry still needs the exact confirmation digest and mapping source. If the mapping file is present, its hash must also match.
- This path only reads; it never writes. The test covers it at line 389.

**4. Other prior notes still stand, and none blocks delivery.**
- Multi-child (planned) Missions only get prompt guidance to separate ownership; nothing enforces it.
- A selected `working-tree@<rev>` receipt is tied to the candidate as it is at recovery time, not when the receipt was recorded.

### Regression check
- The fallback only applies when the heading is completely missing. A malformed declaration still fails.
- A contract approved through some other path without the section gets the old full-scope behavior. That keeps every criterion owned by the child, and recovery can still fix a cycle, so it opens no gap.
- I found no other changes to the derivation, approval, review or receipt paths.

### Divergence and evidence
- **scope_divergence: none.** All 15 changed paths match `git status`: 13 modified plus `src/utils/mission-verification-boundary.js` and `tests/test-mission-verification-boundary.js` untracked. Every change falls within the contract's in-scope items.
- **procedure_divergence: none.** The outcome discloses that the engine-integration fixture was edited but its command was not run, because only three commands are authorized.
- **evidence_integrity: complete.**
  - The receipt identity matches `85de31a46a8f74a27f6bd07a745fdd2dd1e41c73b2c0cd7e533ef2523712cdf4`.
  - The artifact digests match the receipt. The contract (`bee431…`) and plan (`d4f84c…`) are unchanged; progress is `af524d…` and outcome is `06b20b…`.
  - The repair rerun of `node tests/test-mission-verification-boundary.js` passed as authoritative evidence. It replaces the earlier run of the same command.
  - The earlier `npm run test:mission-environment` and `npm run test:reviewloop-modes` receipts still apply. The repair only changed the no-declaration derivation branch and the read-only retry path, and those suites do not exercise either: every Mission fixture they use declares ownership.
  - I ran no tests.
- **Dependencies:** none added or upgraded.
- **user_reapproval_required: false.**

### Acceptance status
- **AC-1: passed.** New Missions need an explicit ownership declaration and their children carry no dependency on the controller's later evidence. Older approved Missions keep their original behavior and do not get stuck.
- **AC-2: passed.** The recovery regression covers preview, stale confirmation, wrong child, attempts to widen scope through the mapping, live attempts, a changed candidate, kept history, interrupted retry, retry after the mapping file is deleted, and repeat runs after completion.
- **AC-3: passed.** The fixture based on M00001/00084 now starts from an approval made before the upgrade. It moves from the blocked child through recovery to fresh review and the controller's final verification, and completes only on passing final evidence. Failed or missing final evidence keeps the Mission incomplete, and qualification-only receipts are not promoted.