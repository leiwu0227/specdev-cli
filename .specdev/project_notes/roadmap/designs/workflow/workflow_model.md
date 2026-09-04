# Workflow Model

Parent design: `../core_concepts.md`

SpecDev represents governed work as a relationship between human intent, delegated
authority, execution, evidence, review, and durable outcome. A workflow controls how
that relationship may change; it does not generate product authority simply because
a command or agent ran.

An objective establishes why work exists. Its authority boundary identifies what may
be inspected, changed, decided, verified, and delivered, including decisions reserved
for the user. Approval-gated workflows bind the exact contract hash and relevant Git
base so later edits cannot inherit stale authority.

Execution consists of deterministic commands and agent Attempts. Attempts may fail,
resume, or be replaced without changing workflow identity. Execution ownership is
frozen where product mutation begins, and candidate identity binds the resulting
artifacts, repository state, evidence, and policy.

Qualification evidence establishes readiness for a boundary such as review.
Acceptance evidence connects observable criteria to the exact candidate. A review
round is an independent judgment under a frozen policy; repair creates a new
candidate and round. Delivery binds the accepted candidate, evidence, review
disposition, outcome, and Git revision.

Workflow shapes match recovery needs. Direct and Roadmap are stateless interactions.
Adhoc is a graph-free one-shot transaction with temporary ownership state.
Discussion and Test Audit are isolated RippleGraph callables. Assignment is the
focused contract lifecycle. Mission is a focused controller that delegates to
Assignment children. Knowledge curation and maintenance operations have their own
bounded governance without becoming delivery lanes.

Only one focused Assignment or Mission scheduler exists. Independent callables may
coexist because they are product-read-only. Graph-free work can coexist only while
ownership and Git boundaries remain unambiguous. An Adhoc detour blocks focused
advancement and leaves an explicit revalidation obligation.

Recovery rereads durable artifacts and engine state, verifies current Git and process
facts, and converges idempotently. Changed contracts, stale evidence, uncertain
writers, or incompatible historical state fail closed with an explicit next action.

## Source Targets

- `src/commands/dispatch.js` — maximum 240 lines — public command routing and cross-lane gates.
- `src/utils/commands.js` — maximum 140 lines — canonical public command catalog.
- `src/utils/status-view.js` — maximum 320 lines — unified active and historical workflow projection.
- `src/commands/continue.js` — maximum 120 lines — focused recovery entrypoint.
- `src/commands/next.js` — maximum 40 lines — canonical focused next-action entrypoint.
- `src/commands/status.js` — maximum 40 lines — status entrypoint.
