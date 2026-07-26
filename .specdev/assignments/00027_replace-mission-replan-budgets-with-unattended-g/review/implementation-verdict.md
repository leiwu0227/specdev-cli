---
verdict: approved
material_divergence: false
---

## Findings

Both previously blocking findings are repaired and verified in the current working tree.

**AC-1 repair lineage (resolved)** — `validateAndReserveReplannedQueue` (`src/utils/mission.js:97-113`) now re-injects `gap_id`/`gap_stage` from `originalById` when it rebuilds a non-protected pending entry, so a repair child still pending when a later gap is resolved keeps its parent-gap binding. `recordMissionChildGap` (`src/commands/mission.js:1994-2019`) therefore reaches `advanceMissionGap`/`closeMissionGap` on the parent gap instead of opening a fresh `child:R_A` gap. `original` is read before the resolution agent edits `assignments.yaml` (`src/commands/mission.js:2033` vs `2105`), and every in-flight status mutation edits the parsed queue object in place, so no other path strips the fields. Covered by the pending-entry lineage assertions and the `bindReplannedQueueToGap` add-exactly-one check in `tests/test-vnext-foundations.js:798-841`.

**Legacy `replan` dead-end (resolved)** — `normalizeMissionGapResolutionForGraph` converts an `evidence-closed` resolution into an explicit `infrastructure-failure` when the pinned node's enum cannot express it, the controller then fails the gap and terminates through `completeMissionFailure` (`src/commands/mission.js:559-602`); `missionGapTransitionDisposition` maps it onto the 1.3.0 `objective-failure` edge, and `assertMissionTransitionRecorded` now treats `state.status === 'validation_error'` as a hard error rather than a silent drop (`src/utils/mission.js:150-179`, `src/commands/mission.js:677-696`). Verified that `graph.node.outputSchema` is the *current* node's schema in the ripplegraph `CoachState` contract, and that `validateOutput` ignores extra properties absent `additionalProperties: false`, so the richer `resolve-gap` payload still validates against pinned 1.3.0 `replan`, `advance-queue` (`follow_up_required`), and `final-verification` nodes. Covered by `tests/test-vnext-foundations.js:854-880` and `adoptLegacyMissionReplan` assertions in `tests/test-mission-gaps.js`.

Graph 1.4.0 (`templates/.specdev/workflows/mission-lifecycle/graph.json`) routes `gap_open` from both advance nodes into `resolve-gap`, owns the five new dispositions, and keeps the three failure classes distinct at `failed`; the pinned installed package is untouched. `compactMissionGaps` folds gap detail into both success and failure outcomes. No user-direction prompt remains on any post-approval semantic path.

All three acceptance criteria carry a final result in `outcome.md`, and the receipts in `implementation/progress.json` are at `working-tree@6ca95d3`, which matches current `HEAD`. No dependency was added or upgraded, so no registry/lockfile evidence is required. `package.json` `releaseDate` is `2026-07-26`.

**Non-blocking observations**

- `openMissionGap` still clears only `closed_at`/`evidence` on reopen, so a `final-verification` gap closed by the arbiter and then failing again re-enters directly at `arbiter` with a fresh signal ID each cycle. Termination depends entirely on the arbiter not approving against a failing receipt. Acceptable under the contract's delegation of evidence-safe closure, but a deliberate guard would be worth a follow-up.
- The `node === 'replan'` controller branch and `adoptLegacyPendingReplan` are covered only at unit level (disposition mapping, transition assertion, legacy adoption); no fixture drives the legacy branch end to end. Consistent with the focused-test authority granted by the contract.
