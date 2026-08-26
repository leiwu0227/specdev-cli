---
verdict: approved
material_divergence: false
scope_divergence: clarifying
procedure_divergence: disclosed
evidence_integrity: complete
user_reapproval_required: false
---

## Findings

**Evidence integrity — complete.** Recomputed all four artifact digests against `review/candidate-receipt.json`: contract `a36356a6…`, plan `2d30658e…`, progress `81e08dde…`, outcome `5796ef6a…` all match, and the contract hash matches the receipt's `contract.hash`. `changed_project_paths.count: 11` exactly matches the working tree's non-`.specdev` deltas (`.claude/skills/specdev-adhoc/SKILL.md`, `.codex/skills/specdev-adhoc/SKILL.md`, `package.json`, 4 `src/` files, 2 `templates/` files, 2 `tests/` files). Both verification receipts carry `working-tree@c627bf330ba9b1534b3ae9c9c28d7f17d59a5291`, which is the current HEAD. All 3 acceptance criteria have final results (3 passed, 0 failed/blocked/missing, 0 omitted). No new evidence was executed for this review.

**Dependencies — not triggered.** The `package.json` diff is a single line (`releaseDate` 2026-08-18 → 2026-08-26). No dependency added or upgraded, so no registry/lockfile/advisory evidence is required. The repository instruction to refresh `releaseDate` to the current date (2026-08-26) is satisfied.

**Contract conformance.** Spot-checked the delivery against each constraint rather than re-running the suite:
- Assignment-owned paths (`.specdev/.current`, `.id-counters.json`, `.ripplegraph/current.json`, the run root, the assignment folder, Attempt YAMLs) are classified as preserved and excluded from the exact adoption manifest and from delivery staging (`src/utils/adhoc-assignment.js:98`, `src/commands/adhoc.js` manifest filter and `protectedAdhocPathDetails`).
- `--adopt-dirty` cannot absorb Assignment work: with coexistence active, `adoptedPaths` is forced empty and any dirty product path returns `assignment_dirty_product_conflict` before state creation (`src/commands/adhoc.js` `startAdhoc`).
- Exact-manifest, unchanged-HEAD, and recovery paths are preserved; `concurrentCallablePathDetails` still applies, so Discussion/Test Audit coexistence is unchanged, and neither command is in the dispatch block list.
- No diagnostic in the new code or generated guidance prescribes shelving; every `next_action` states shelving is explicit user-only terminal authority.
- All new cross-module imports resolve to real exports (`readFocusedAssignmentLifecycle`, `listAttemptRecords`, `attemptLiveness`, `resolveTargetDir`), and the dispatch guard's `.specdev/cache/adhoc.json` path matches `activePath()` at `src/commands/adhoc.js:736` — so the guard actually fires rather than silently no-opping.

**Scope divergence (clarifying, non-blocking).** `inspectAssignmentRun` (`src/utils/adhoc-assignment.js:129`) admits coexistence only when the checkpoint sits at exactly `assignment-lifecycle` / node `design`. AC-1 and the Expected-behavior section define the safe window by absence of an implementation Git boundary, which also covers `create-assignment`, `brainstorm`, and `approve-contract`. A quiescent Assignment at one of those earlier nodes is refused with `assignment_state_ambiguous` rather than allowed. This is fail-closed — it never mutates or terminates the Assignment, and the contract's risk section directs uncertain ownership to block — and the shipped guidance discloses it verbatim ("quiescent **approved** pre-implementation boundary") in `templates/.specdev/_main.md`, `_guides/workflow.md`, and both host SKILL.md files. It is not recorded in `outcome.md`'s Deviations, so it is surfaced here for the user approval gate. Not blocking.

**Procedure divergence (disclosed, non-blocking).** `progress.json` and `outcome.md` disclose three fixture repairs made before the passing run. I verified the one with masking potential: `tests/test-engine-integration.js` moved `assignment-lifecycle@2.2.0` → `@2.3.0` and `mission-lifecycle@1.4.0` → `@1.5.0`. The shipped graphs under `templates/.specdev/workflows/` are already at 2.3.0 and 1.5.0 and are untouched by this candidate (last modified in `b6ad908`, delivery 00052). The assertions were corrected to the true shipped values, not loosened. The `tests/test-init-platform.js` delta is additive assertions plus one formatting reflow. Evidence remains complete, so this is approvable.

**Observation, not a defect.** `assignmentOwnedPathDetails` preserves the whole `.specdev/processes/` and `.specdev/.ripplegraph/runs/` prefixes, not only the focused Assignment's own records. That is broader than the enumerated `preserved_paths`, but the contract explicitly requires excluding "pre-existing lifecycle cleanup outside Adhoc scope" from the delivery commit, and the helper returns `null` when no coexistence is active, so ordinary Adhoc behavior is unchanged.

No blocking contract defect remains.
