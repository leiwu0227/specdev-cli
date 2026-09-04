# Core Concepts

SpecDev is a repository-resident development system for coding agents. It lets an
agent do substantial work while keeping product authority, workflow position,
evidence, and delivery understandable to the user and recoverable by later sessions.

The human owns product direction. An agent receives bounded authority to inspect,
decide, change, verify, or deliver. Within that boundary it may act autonomously;
when scope, assumptions, evidence, review, or outcomes diverge materially, it must
surface the decision rather than silently widening its authority.

SpecDev separates four sources of truth. Human-readable artifacts own approved
intent and durable conclusions. RippleGraph checkpoints own recoverable position for
stateful workflows and isolated callables. Git owns source revisions and delivery
identity. Provider sessions, process records, caches, indexes, and temporary
worktrees are operational aids that can be replaced.

The public Node.js CLI is the semantic boundary. Commands interpret user intent,
enforce authority, coordinate deterministic mechanisms, and advance versioned graph
packages only through supported transitions. RippleGraph supplies orchestration; it
does not decide product intent, judge evidence, or create delivery authority.

Work is routed by meaning rather than apparent size. Direct handles answers,
inspection, and bounded non-behavioral documentation. Roadmap records user-approved
target designs and code gaps. Adhoc performs one bounded mutation transaction.
Discussion and Test Audit are concurrent product-read-only callables. Assignment
delivers one approved contract. Mission controls an integrated objective through
one or more Assignment children. Knowledge curation is a separate approval-bound
publication action rather than another lane.

Agents execute explicit roles. Foreground collaborators shape authority with the
user; workers implement; reviewers inspect without repairing; Mission controllers
schedule and integrate; resolvers repair bounded non-convergence; arbiters provide
fresh final judgment. Each external invocation is an Attempt, not a workflow
identity. Provider profiles and adapters translate these neutral roles into native
CLI capabilities without weakening the core rules.

Acceptance evidence connects observable criteria to an exact candidate. Review
decisions apply only to the candidate and policy that were inspected. Delivery
binds approved intent, evidence, review disposition, durable outcome, and Git
revision. Recovery fails closed when those identities disagree.

The installed `.specdev/` layer combines managed runtime guidance with preserved
project-owned records, engine state, and ignored operational state. Product behavior
is authored in `src/`, managed installed assets originate in `templates/.specdev/`,
and live project state is never treated as a second product implementation.

This architecture deliberately adds ceremony only where ownership, recovery,
review, concurrency, or delivery risk justifies it. Its central promise is not that
agents avoid surprises, but that surprises cannot silently become accepted project
history.
