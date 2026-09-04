# Mission Lane

Parent design: `./workflow_lanes.md`

Mission is the foreground controller for a user-approved integrated objective whose
delivery benefits from Assignment delegation, parent-level convergence, or bounded
concurrency. It is not synonymous with large work: one deterministic full-scope
child is preferred when semantic decomposition is unnecessary.

The exact parent contract defines objective, integrated scope, constraints, reserved
decisions, child-delegation boundaries, acceptance criteria, review policy, and one
final verification command. User approval binds its hash, base revision, Mission
branch, and policy. Brainstorm review may advise but never approves.

The Mission owns the one focused scheduler. Its controller plans a static child queue,
creates bounded Assignment contracts, launches Attempts, evaluates child evidence and
review, integrates reviewed candidates, tracks durable gaps, and decides when the
parent objective has converged. Children inherit parent authority and may specialize
it but cannot expand it or independently land the parent result.

Sequential execution is the default. A parallel wave may contain any planned set of
mutually independent children, while the controller runs at most three concurrently.
Parallel work requires isolated paths, dependencies, verification, and integration
order. The controller alone leases ignored worktrees, integrates results into the
Mission branch, and retires operational worktrees.

Child success is not parent success. The integrated candidate must satisfy all parent
acceptance criteria and the exact final verification boundary. Findings, failed
evidence, follow-up, conflicts, or materially changed assumptions become durable
gaps. Resolution remains linked to parent authority rather than becoming an
unbounded retry chain.

Material divergence pauses at a content-addressed user reapproval decision. Historical
state is migrated only through explicit compatibility rules. Interrupted controller,
worker, integration, or final-verification operations recover from durable queue,
artifacts, Attempts, Git facts, and journals.

Completion records an integrated outcome and exact Mission commit, then automatically
attempts the separate fast-forward landing operation. If landing preconditions are
not satisfied, completion remains durable and an explicit landing command can retry
the pending operation. Abandonment uses a reasoned two-step terminal transaction that
preserves branches and inspectable partial work.

Child designs own execution/waves and recovery/delivery mechanics.

The current 5,000-line Mission command cap is a transitional compatibility ceiling,
not a growth allowance. New responsibilities belong in focused child modules, and
later extraction should lower the cap.

## Source Targets

- `src/commands/mission.js` — maximum 5000 lines — parent lifecycle, controller, queue, convergence, and public subcommands.
- `src/utils/mission.js` — maximum 430 lines — Mission identity, queue, findings, and transition invariants.
- `templates/.specdev/workflows/mission-lifecycle/graph.json` — maximum 420 lines — recoverable parent lifecycle.
