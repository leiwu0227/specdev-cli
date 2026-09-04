# Assignment Execution Modes

Parent design: `./assignment_lane.md`

Assignment execution has one explicit implementation owner. It may remain inline
with the foreground agent or be delegated to a spawned worker without changing the
approved contract, evidence obligations, review independence, or delivery boundary.

Inline execution preserves interactive project context and returns planning,
mutation, evidence capture, and repair obligations to the foreground agent. Spawned
execution invokes a bounded worker Attempt under a resolved profile while the
foreground command retains lifecycle coordination. Standalone work defaults to
inline; Mission child work preserves controller-owned delegation.

The effective mode, decision source, owner, profile, and any non-default reason freeze
before the implementation Git boundary. Existing eligible dirt may be adopted only
through the supported exact-boundary decision. Once mutation begins, SpecDev does not
silently transfer ownership between executors.

Both modes produce the same plan, progress record, worker-result semantics,
acceptance mapping, candidate receipt, and review inputs. Inline mode returns
action-required obligations to the foreground. Spawned mode parses a strict result
envelope and preserves the worker outcome for resume.

Repairs return to the frozen owner. A failed or malformed spawned Attempt can use an
explicit replacement path; it does not silently fall back to inline work around an
ambiguous dirty tree. Loss of an inline session is recoverable from durable artifacts
and workflow state.

Reviewer identity remains independent in either mode. Faster execution or retained
session context cannot waive evidence, alter the contract, or grant lifecycle
authority to the worker.

## Source Targets

- `src/commands/implement.js` — maximum 800 lines — execution orchestration, repair obligations, and lifecycle advancement.
- `src/utils/assignment-execution.js` — maximum 260 lines — mode resolution, freezing, and projection.
- `src/utils/spawned-agent.js` — maximum 900 lines — delegated worker execution and result protection.
