# Assignment Terminal Operations

Parent design: `./assignment_lane.md`

Assignment terminal operations preserve exact meaning when work succeeds, is shelved,
or is closed as unsupported. Historical abandoned states may still be recognized for
compatibility, but no ordinary Assignment close command creates them. Terminal state
is not shorthand for deleting work or declaring an incomplete candidate successful.

Successful standalone delivery validates the current candidate and artifacts, stages
only Assignment-owned product and durable paths through an isolated index, writes a
trailer-bearing commit, verifies its identity, records the outcome, preserves a
bounded Attempt activity summary, and compacts terminal runtime. Repeated completion
recovers the same delivery rather than creating a second commit.

Shelving retires an unfinished standalone Assignment as immutable durable history;
continuation requires a successor Assignment. If the
worktree contains owned changes, the first call produces a content-addressed snapshot
decision. Exact confirmation creates a recoverable snapshot boundary before terminal
state is published. Shelving does not discard or silently adopt unrelated dirt.

Explicit close records only an unsupported outcome and requires attributable written
evidence. A prepared journal binds the exact reason, paths, Attempts, and Git state;
changed inputs invalidate confirmation. Unsupported
closure preserves inspectable artifacts and a verified terminal commit without
claiming delivery.

Terminal operations detect interrupted prepared states, existing trailer-bearing
commits, and leftover runtime. Recovery finishes the same transaction idempotently.
Ambiguous staged content, branch state, evidence, ownership, or live Attempts fails
closed.

Mission-owned children use parent-controlled terminal and integration semantics;
standalone shelf or close cannot detach them from Mission authority.

The current 1,100-line close-command cap is a transitional compatibility ceiling.
New terminal responsibilities should be extracted into focused modules and the cap
reduced over time.

## Source Targets

- `src/commands/assignment-close.js` — maximum 1100 lines — evidence-bearing unsupported closure.
- `src/commands/assignment-shelf.js` — maximum 850 lines — shelving and snapshot confirmation.
- `src/utils/assignment-delivery.js` — maximum 1200 lines — successful standalone delivery and recovery.
- `src/utils/artifact-retention.js` — maximum 250 lines — terminal runtime compaction.
