# Runtime and cleanup

Read this reference when inspecting runtime ownership, cleaning up completed work,
or assessing workflow artifacts.

Successful Mission and standalone Assignment completion preserves a compact
activity summary. It then removes the terminal run and its owned Attempt records.
Attempt execution records use IDs such as `Attempt-00001`; they are temporary
worker, reviewer, or controller invocations, not Assignment identities. Legacy
`ATT-*` records may remain while older in-flight work resumes.
Successful Assignment, Discussion, and Mission completion also removes owned
raw logs and scratch results. Discussion completion preserves compact durable
completion/activity metadata for listing and promotion. Explicit abandonment
cleans owned temporary cache after its terminal record is preserved. Active,
interrupted, failed/recoverable, and shelved work retains diagnostic cache.
Failed Missions retain their execution history and owned Attempt records through
successor handoff and delivery. Terminal runtime status alone does not authorize
cleanup. Cleanup verifies the durable owner and remaining lifecycle obligations.
A successor cannot authorize deletion of its predecessor's recovery or closure
records. Failure publication has its own exact commit and can be retried with
`specdev mission run <id>` without restarting execution.
Use `specdev cleanup` to preview eligible leftovers and reclaimable bytes;
`specdev cleanup --apply` revalidates ownership before removing them. Both accept
`--json`. Unknown ownership, live/uncertain Attempts, symlinks, and unsafe paths
are retained and reported. Shared caches and durable evidence are preserved.

For project reviews, start with `missions/` and `assignments/`. They hold the
approved authority, delivery evidence, and outcomes. Keep installed workflow
packages and skills as durable infrastructure. RippleGraph checkpoints and
process records support recovery until work reaches a terminal state.
In summaries for people, count or group these records rather than list every file.
