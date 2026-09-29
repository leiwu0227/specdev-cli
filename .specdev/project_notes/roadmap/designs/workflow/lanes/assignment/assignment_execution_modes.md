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

Both modes, including Mission children and repairs, favor the simplest complete
implementation of approved behavior. Understand the affected flow and relevant
callers first. Prefer existing code and project patterns, standard-library or native
capabilities, and suitable installed dependencies before adding machinery. Stop
searching when a sound, appropriately scoped approach is established. Fix the actual
source of a problem rather than accumulating patches at individual callers.

Additional abstractions, dependencies, configuration, compatibility paths, and
fallbacks need concrete current justification. A single caller or implementation
does not alone invalidate an abstraction; preserve useful architectural boundaries
and readability. Line and file counts are not measures of correctness or simplicity.

Owners resolve routine choices within delegated authority without reopening settled
scope. Ask when missing information materially affects behavior, scope, or authority,
or when an actual conflict prevents correct delivery. Hypothetical concerns alone
do not justify blocking. Simplicity never waives required validation, security,
accessibility, error handling, or acceptance evidence.

Use proportionate authorized verification and reuse valid evidence. Finish once
approved behavior and delivery obligations are complete. Record a deliberate
limitation and its revisit trigger in an appropriate existing artifact or code
comment when needed; ordinary simplicity requires no debt ledger, extra phase,
mode setting, or external plugin.

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
- `templates/.specdev/_guides/assignment_guide.md` — maximum 140 lines — shared simplicity guidance for planning, implementation, and repair.
