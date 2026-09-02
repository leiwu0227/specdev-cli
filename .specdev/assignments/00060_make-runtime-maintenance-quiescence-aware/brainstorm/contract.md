# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Prevent `specdev update` from replacing managed runtime, workflow packages, skills, hooks, or adapters while durable Attempt ownership is live or uncertain. Apply one quiescence policy to both a new update and an existing update-completion operation, following the state-ownership and fail-closed rules in `project_notes/roadmap/designs/foundations/specdev_state_model.md` and `project_notes/roadmap/designs/foundations/installed_layout.md`.

## Scope and non-goals

- In scope: a shared update-maintenance preflight over durable running Attempts; local liveness classification; safe stale-Attempt reconciliation; human and JSON diagnostics; initial update, `--operation` resume, dry-run, and status behavior; focused regression coverage.
- Non-goals: changing Assignment, Mission, Adhoc, or Discussion lifecycle semantics; killing processes; adding a force bypass; guarding `specdev init`, migration, or independently invoked skills commands; implementing other Roadmap gaps.

## Expected behavior

- Before any managed-runtime, engine-package, skill, hook, adapter, or update-completion mutation, inspect every durable Attempt whose status is `running`, independent of owner or role.
- A live local Attempt blocks maintenance. A running Attempt without trustworthy local liveness is ambiguous and blocks maintenance. Diagnostics identify the Attempt, available ownership, liveness classification, and a safe next action.
- A provably stale local Attempt may be changed from `running` to `interrupted` and have only its stale local process marker retired. Maintenance proceeds only after a fresh inspection establishes quiescence; reconciliation failure blocks before managed mutation.
- `--dry-run` and `--status` remain read-only and usable in non-quiescent states. They neither reconcile Attempts nor mutate managed or project-owned state.
- Initial calls, resumed update-completion operations, and retries use the same current inspection rather than cached authorization. Repetition converges without duplicating workflow identity or overwriting project-owned durable state.

## Important decisions

- Reuse the provider-neutral Attempt record and `attemptLiveness` model rather than adding an update-specific process registry.
- Treat `unknown`, unreadable, malformed, or otherwise unclassifiable running ownership as ambiguous. PID reuse may conservatively produce a live classification; safety takes precedence over automatic takeover.
- Stale reconciliation is limited to execution bookkeeping already proven locally dead. It does not close, shelf, abandon, advance, or compact the owning workflow.
- Read-only commands may report quiescence facts but do not acquire authority to repair them.

## Constraints and invariants

- Project-owned state is preserved exactly; this Assignment may change product source, generated runtime templates or guidance where required, and focused tests, but not user project records.
- The quiescence decision must occur before the first update mutation, including skill-root repair and update-completion graph transitions.
- Non-running Attempt history never blocks maintenance and is not rewritten.
- Existing adapter reconciliation remains governed by its current explicit operation and validation rules after quiescence succeeds.

## Delegated and reserved authority

- Delegated: implement the bounded shared preflight, integrate it into update entry points, add actionable output, and add focused tests and minimal generated guidance needed for the behavior.
- Reserved for the user: authorizing tests under repository policy; any full-suite run; any force override, process termination, broader maintenance guard, or change to workflow terminal semantics.

## Risks and assumptions

- Local PID liveness cannot prove remote execution; missing local evidence therefore remains ambiguous and blocking.
- A stale reconciliation can precede a later update failure. Recording the Attempt as interrupted is still truthful, and a retry must safely converge from that state.
- The current update path performs several mutations in sequence, so integration must ensure none can occur before the shared preflight succeeds.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Initial `specdev update` and mutating `specdev update --operation=<id>` calls inspect all durable running Attempts before their first managed or update-completion mutation; live, unknown, malformed, or unclassifiable ownership fails closed with actionable human and JSON diagnostics and leaves update-owned paths unchanged.
- AC-2: Provably stale local running Attempts are reconciled only to `interrupted` with their stale local marker retired, followed by a fresh quiescence check; non-running records and owning workflow state are preserved, and repeated or interrupted update calls converge safely.
- AC-3: `specdev update --dry-run` and `specdev update --status` remain non-mutating and available when Attempts are live, stale, or ambiguous, while existing quiescent update and adapter-completion behavior continues unchanged.
