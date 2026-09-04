# Workflow Lanes

Parent design: `../workflow_model.md`

A workflow lane is a user-facing authority model for a class of work. Lanes differ
by intent, mutation authority, approval boundary, recoverability, concurrency, and
durable outcome—not merely by task size or command name.

Direct handles questions, explanations, read-only inspection, status, and small
non-behavioral documentation. Roadmap is stateless collaboration on approved target
designs and dependency-ordered code gaps. Adhoc is a graph-free one-shot mutation
transaction with a receipt and delivery commit.

Discussion and Test Audit are isolated RippleGraph callables. Both are product-read-
only, own their artifacts independently, and may coexist with focused work. A
Discussion synthesizes an open design question; a Test Audit evaluates redundant
test protection and prepares a possible Assignment contract.

Assignment and Mission share the one focused scheduler. Assignment delivers one
exact approved contract. Mission controls an integrated parent objective, delegates
bounded Assignment children, schedules sequential or justified parallel waves, and
owns convergence and landing.

Knowledge curation, update completion, and layout migration are approval-bound or
recoverable actions without becoming general-purpose lanes. A new action becomes a
lane only when it owns a durable user-facing class of work rather than one narrow
transition.

The user explicitly selects governed lanes. An agent may recommend the lightest
sufficient lane but cannot infer mutation authority from file type, effort, or prior
analysis. Moving from Discussion, Test Audit, or Roadmap into implementation creates
fresh authority.

Concurrency depends on ownership. Only one focused scheduler exists. Isolated
callables may coexist because they cannot mutate product. Adhoc may temporarily
coexist at quiescent pre-execution boundaries, blocks focused advancement while
active, and requires post-detour revalidation. Direct and Roadmap have no lifecycle
but cannot bypass another owner's Git or artifact boundary.

## Source Targets

- `src/commands/dispatch.js` — maximum 240 lines — command routing and cross-lane advancement gates.
- `src/utils/status-view.js` — maximum 320 lines — unified lane and lifecycle presentation.
- `templates/.specdev/_main.md` — maximum 240 lines — installed lane-selection contract.
