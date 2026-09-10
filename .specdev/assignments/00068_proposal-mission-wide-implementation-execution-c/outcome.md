# Outcome

## Delivered behavior

Mission approval now stops at a durable, explicit inline-or-spawned implementation
choice with no default. Inline Missions keep all child implementation, repair, and
resolver work in the current coding session, return structured foreground handoffs,
and serialize every wave without worktree leasing. Spawned Missions retain automatic
workers and eligible parallel waves. Existing approved Missions without the new field
continue as legacy-spawned.

The selected mode is projected through Mission status, frozen onto every child
Assignment, enforced by parallel-entry guards, and documented in installed workflow
guidance and generated Mission skill mirrors. Independent review and existing evidence,
recovery, and delivery gates remain unchanged.

## Deviations

None.

## Unresolved risks

None.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Engine integration and Mission compatibility tests cover the no-default choice, durable selection, switching rejection, and legacy-spawn projection. | Passed |
| AC-2 | Engine integration and reviewloop mode tests cover initial, repair, and resolver foreground obligations with no implementation worker or parallel worktree. | Passed |
| AC-3 | Graph-package, successor-adoption, recovery, status-visibility, and update-workflow tests cover spawned compatibility and shared lifecycle invariants. | Passed |
