# Mission Recovery and Delivery

Parent design: `../mission_lane.md`

Mission recovery preserves approved authority and exact Git identity across
interruptions, historical schema changes, material divergence, successor adoption,
landing, and abandonment.

Compatibility checks compare the active checkpoint, contract, approval, queue,
artifacts, Attempts, branch, and engine package with the current semantic contract.
Safe shape differences may migrate idempotently through a journal. Missing authority,
unknown states, changed hashes, or unsupported transitions fail closed instead of
guessing how an old Mission should continue.

Material child or parent divergence creates a content-addressed preview containing
the changed objective, authority, candidate, evidence, and proposed action. Repeated
status and run calls remain provider-free until the user approves or rejects that
exact identity. Rejection preserves the current state and requires a new bounded
resolution.

Successor adoption is exceptional recovery for an active Mission blocked inside its
owned child. The first call builds a read-only plan binding candidate ancestry,
contracts, reviews, evidence, commands, environment, cleanup, and excluded dirt.
Exact confirmation supersedes the predecessor without rerunning a provider or
claiming unrelated work.

Mission completion requires an integrated reviewed candidate and passing final
verification. It records a durable outcome and exact Mission commit, then attempts
landing automatically. Landing validates source and destination branches, ancestry,
worktree cleanliness, and delivery trailers before applying a fast-forward-only
repository-history operation. If it remains pending, the explicit landing command
retries the same validation and operation.

Abandonment is a separate reasoned two-step terminal transaction. Inspection reports
children, branches, worktrees, Attempts, owned paths, and prospective effects.
Confirmation binds the unchanged plan, writes terminal history, compacts only owned
runtime, and preserves branches, worktrees, and partial product work for the user.

Every operation is recoverable and idempotent. Journals and trailers locate already
performed Git effects; durable records are written before replaceable runtime is
retired.

Caps at or above 1,000 lines are transitional compatibility ceilings for the current
implementation. New recovery or abandonment responsibilities should be extracted
into focused modules so those ceilings can fall.

## Source Targets

- `src/utils/mission-migration.js` — maximum 1500 lines — historical compatibility migration and recovery.
- `src/utils/mission-reapproval.js` — maximum 350 lines — content-addressed divergence decisions.
- `src/utils/mission-successor-adoption.js` — maximum 700 lines — exact successor planning and adoption.
- `src/utils/mission-landing.js` — maximum 300 lines — landing validation and Git operation.
- `src/commands/mission-abandon.js` — maximum 1000 lines — two-step abandonment transaction.
- `src/utils/mission-compatibility.js` — maximum 450 lines — current-state compatibility checks.
