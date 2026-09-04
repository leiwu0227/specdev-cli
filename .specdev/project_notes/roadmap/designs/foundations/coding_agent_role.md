# Coding Agent Role

Parent design: `../core_concepts.md`

SpecDev treats coding agents as bounded collaborators and executors, never as the
source of product authority or durable workflow truth. A role defines what an
invocation may inspect, change, decide, verify, and report.

The foreground agent collaborates with the user, classifies work, authors proposed
authority, and performs inline work when selected. A worker implements one approved
scope. A required reviewer independently inspects an exact candidate and remains
product-read-only. A Mission controller schedules children and integrates their
results without inventing parent authority. A resolver performs one bounded repair
after failed convergence; an arbiter provides fresh judgment without repairing.

An Attempt is one provider invocation in one role. It records role, scope, profile,
process status, result, and bounded usage facts. Attempts are replaceable operational
executions, distinct from lane, Assignment, Mission, Discussion, and review-round
identities.

Agent profiles resolve provider, model, effort, permissions, network policy,
transport, timeout, and session capabilities. Project-tracked policy and ignored
machine overrides combine deterministically. The effective profile freezes when
candidate identity or review independence requires it.

Provider adapters translate neutral roles into native CLI arguments and output
streams. Strict result envelopes convert provider prose into governed outcomes.
Malformed, missing, or contradictory results are blocked or retried within bounded
policy; they never advance workflow meaning merely because the provider exited.

Session continuation is optional operational context. It cannot cross unrelated
identities, merge worker and reviewer authority, or become the sole record of
decisions. Durable contracts, evidence, findings, and outcomes must always permit a
fresh agent to recover.

Capabilities follow least authority. Reviewers cannot mutate the candidate; workers
cannot approve their own scope; controllers cannot expand the parent objective.
Provider convenience never weakens a semantic gate.

## Source Targets

- `src/utils/agent-profiles.js` — maximum 160 lines — layered profile resolution.
- `src/utils/provider-adapters.js` — maximum 190 lines — provider-neutral capability translation.
- `src/utils/agents.js` — maximum 60 lines — installed agent-spec discovery.
