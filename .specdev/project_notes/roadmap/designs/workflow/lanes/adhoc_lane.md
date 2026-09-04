# Adhoc Lane

Parent design: `./workflow_lanes.md`

Adhoc delivers one explicitly selected bounded repository change without a contract
graph, spawned worker, or automatic review. It is stronger than Direct because it
owns mutation, evidence, a durable receipt, and one exact delivery commit.

Start records scope, title, Git revision, current dirt, focused coexistence, and an
exact adoption manifest. Existing product changes block unless the user deliberately
adopts the complete eligible set. Discussion and Test Audit state is independently
owned and cannot be adopted. Ambiguous owners, live Attempts, staged conflicts, or
an unsupported focused-workflow position fail closed before state is created.

An active Assignment or Mission may coexist only while it is forming authority or at
a supported quiescent pre-execution boundary. Adhoc blocks that workflow from
approval, execution, review, replacement, termination, or Git advancement. Finish or
cancel leaves a durable revalidation obligation; the focused workflow must compare
its assumptions with the changed product before crossing its next boundary.

Implementation is performed directly in the current worktree. Verification commands
run only with repository or user authorization. Each labeled attempt records command,
status, exit result, and bounded output; failed attempts remain alongside later
passing reruns.

Finish builds a receipt from persisted scope and Git facts, validates the owned path
set, uses an isolated temporary index, creates one trailer-bearing commit, verifies
the commit, and clears active state only after the worktree boundary is correct.
Recovery detects an already-created delivery and converges without duplicating it.

Cancellation ends Adhoc ownership but leaves source changes untouched. It does not
interpret cancellation as permission to revert user work.

The current 1,350-line Adhoc command cap is a transitional compatibility ceiling,
not a growth allowance. New responsibilities should be extracted into focused
modules, allowing the cap to fall.

## Source Targets

- `src/commands/adhoc.js` — maximum 1350 lines — transaction lifecycle, evidence, receipt, and delivery.
- `src/utils/adhoc-focused.js` — maximum 520 lines — focused coexistence and revalidation obligations.
- `src/utils/workspace-changes.js` — maximum 110 lines — workflow-aware dirt classification.
- `src/commands/dispatch.js` — maximum 240 lines — focused advancement blocking during a detour.
