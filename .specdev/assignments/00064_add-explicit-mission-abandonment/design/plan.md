# Implementation plan

## Knowledge search

- Fresh bounded query: `mission abandonment terminal ownership worktree landing`
- Relevant verified-history paths read:
  - `.specdev/assignments/00030_make-mission-landing-explicit-safe-and-user-action/outcome.md`
  - `.specdev/assignments/00032_terminal-run-residual-artifact/outcome.md`
  - `.specdev/assignments/00036_close-terminal-evidence-recovery-gaps/outcome.md`
- Applied constraints: preserve retained Git identities, use exact terminal commits,
  keep terminal-runtime cleanup owner-scoped, and recover only from explicit durable
  authority.

**Implementation Guides:** [api-security]

**Review Guides:** []

## Tasks

### T-1 — Add exact Mission-abandonment planning and recovery (AC-1, AC-2, AC-3)

Implement a reason-bound, content-addressed `specdev mission abandon` plan that
performs no write before `--confirm=<digest>`. Validate Mission/run/focus identity,
terminal immutability, all owned Attempt liveness, the checked-out Mission branch
and HEAD, clean main and registered child worktrees, child branch attribution, and
queue/checkpoint/record snapshots. After confirmation, persist an ignored versioned
journal and converge idempotently through terminal artifact/status writes, owned
RippleGraph abandonment and compaction, matching focus clearing, and one exact
terminal commit without landing or deleting retained work.

### T-2 — Make abandoned Missions observably terminal everywhere (AC-1, AC-3)

Expose the abandonment reason, artifact, retained Mission/base/child identities,
terminal commit, and null delivery/landing in Mission status. Refuse run, pause,
migrate, checkpoint, handoff, landing, successor adoption, and divergence decisions
for an abandoned Mission so no state-mutating command can reinterpret or overwrite
the terminal record. Add CLI help and managed workflow guidance.

### T-3 — Add focused regression coverage without executing it (AC-1, AC-2, AC-3)

Add a focused Mission-abandonment fixture for read-only planning, stale confirmation,
liveness/branch/dirt/worktree refusal, retained branch/worktree identity, exact
terminal publication, runtime compaction, crash recovery, idempotent retry, status
visibility, and terminal-command guards. Register the focused command and lint path.

### T-4 — Record bounded verification and delivery evidence (AC-1, AC-2, AC-3)

Request explicit test authorization before executing any test command. Record every
authorized focused receipt—or the approval blocker—in `implementation/progress.json`,
update the required release date, inspect the exact diff, and write the worker result
and outcome for independent implementation review.
