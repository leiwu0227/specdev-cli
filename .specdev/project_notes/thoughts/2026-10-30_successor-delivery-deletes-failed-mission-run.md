# Successor delivery deletes a failed Mission run

Date: 2026-10-30

Context: live use in `submarine` (SpecDev 0.0.4). Mission M00002 failed at
its convergence gate. Successor Assignment 00014 recovered the evidence. The
user then asked to close M00002 as accepted with limitations.

## Summary

A Mission failed at its convergence gate. A successor Assignment then
recovered the missing evidence. When that Assignment was delivered, its
cleanup deleted the Mission's RippleGraph run folder. After that,
`specdev mission close <id> --outcome=accepted-with-limitations` was
impossible without editing SpecDev state by hand.

## Steps to reproduce

1. Run a Mission with Inline execution until its convergence gate fails
   (here, gap `gap-2d6c64c012c7d2ba`, an authority failure). `mission.yaml`
   records `status: failed`.
2. Create a successor Assignment that recovers the unresolved evidence.
   Approve and deliver it (`specdev(assignment): deliver 00014`).
3. Run `specdev mission close M00002 --outcome=accepted-with-limitations
   --evidence=<note>`.

## Expected

The close command produces a plan and digest for a Mission whose source
state is `failed`.

## Actual

1. The first attempt failed with:
   `No checkpoint.json found for run mission-lifecycle-20261029T15071345`.
   The Assignment delivery commit had deleted
   `.specdev/.ripplegraph/runs/mission-lifecycle-20261029T15071345/`.
2. Restoring the folder from the last Mission checkpoint commit (`4ae8611`)
   did not help. The close failed with:
   `Mission run/focus mismatch; another workflow must not be displaced`.

The checkpoint for the failed state was never committed. The last committed
checkpoint still shows `status: active` at node `advance-queue`. The runtime
focus is `focusedRunId: null`. `mission-close.js:190-195` accepts only:

- an active checkpoint with runtime focus equal to `mission.run_id`, or
- a completed checkpoint at node `failed`, with no runtime focus.

The restored state matches neither condition.

## Workaround used

1. Restore the run folder from `4ae8611`.
2. Set `.specdev/.ripplegraph/current.json` `focusedRunId` to the Mission
   run id by hand.
3. Run the close plan and confirm it with `--confirm=<digest>`.

The closure succeeded. Its commit included the checkpoint, the transition
log and both focus files.

## Suggested fixes

- Assignment delivery cleanup must not delete a run that belongs to a Mission
  that is not closed (`status: failed` is closable).
- Commit the checkpoint and transition log when a Mission enters its terminal
  failed state, so the record survives a later cleanup.
- Alternatively, let `mission close` accept a failed Mission whose run folder
  is missing, and use `mission.yaml` as the source state.

## Related, minor

`specdev focus M00002` updates `.specdev/.current` but not the runtime focus
(`.specdev/.ripplegraph/current.json`). The close check reads only the
runtime focus. The error message does not say which of the two focuses
caused the failure.

## Second issue (separate report if preferred)

Reviewers are not told how `owned_paths` digests are computed: SHA-256 over
`"file:"` or `"executable:"` plus the file bytes, with `null` for deleted
files. Reviewers sometimes computed a plain SHA-256 of the file and reported
false digest mismatches. Please include the digest rule in the review handoff.
