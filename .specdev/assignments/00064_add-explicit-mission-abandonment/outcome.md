# Outcome

## Delivered behavior

Added `specdev mission abandon` as a reasoned two-step terminal operation. The
first invocation is read-only and returns a digest-bound plan covering the exact
Mission/run/focus/checkpoint, complete Mission-owned Attempt records, Mission and
queue bytes, checked-out Mission/base/child revisions, registered child worktrees,
and terminal path set. Exact confirmation is revalidated before any durable write.

After confirmation, an ignored versioned journal recovers terminal record writes,
RippleGraph abandonment and owner-scoped compaction, focus clearing, and one exact
`abandonment` commit. The human artifact and Mission/status records retain the
reason and Git/worktree identities, explicitly record no delivery, and never land,
merge, remove, or prune retained work.

Mission status exposes the terminal reason, artifact, plan, retained identities,
and derived terminal commit. Run is read-only terminal reporting, while pause,
migrate, checkpoint, landing, handoff, successor adoption, divergence decisions,
Brainstorm review, and focus all refuse the immutable abandoned Mission.

## Deviations

None.

## Unresolved risks

External Git processes can always race a preflight. The command minimizes that
window by rebuilding the complete plan immediately before its first durable write,
then pins HEAD and the exact terminal path manifest through publication; any
observed mismatch fails closed and retains the recovery journal.

| Acceptance | Evidence                                                                                                                                                                                                                                                              | Result |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1       | `npm run test:mission-abandonment` proves stable read-only planning, exact confirmation, reasoned terminal artifacts/status, retained Git identities, one labelled commit, and post-record runtime compaction.                                                        | Passed |
| AC-2       | The same focused fixture proves pre-mutation refusal for stale plans, wrong branches, dirty main/child worktrees, and live controllers while preserving repository bytes; its plan binds record, queue, checkpoint, focus, branch, and Attempt digests.               | Passed |
| AC-3       | Interruption fixtures recover from terminal-write and prepared boundaries, exact retry is idempotent, status exposes reason and retained work, all mutating paths refuse abandonment, and `npm run test:mission-landing` preserves completion-only landing semantics. | Passed |
