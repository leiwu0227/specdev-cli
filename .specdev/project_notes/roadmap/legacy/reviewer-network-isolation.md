# Reviewer Network Isolation

Status: implemented

## Decision

Reviewer outbound network access is an optional, default-off capability.
Durable configuration and execution records express the effective policy with
provider-neutral `network` and optional `network_domains` values. Domain policy
is reviewer-only; malformed policy, unsupported provider combinations, and
network domains without enabled networking are rejected before launch. Existing
worker-network semantics remain a separate compatibility surface.

Enabling reviewer networking never weakens repository-read-only isolation.
Provider adapters must map the neutral policy to native read-only network
controls, preflight a known-capable provider version before creating or
launching the Attempt, and fail closed when the requested isolation cannot be
enforced. Unsandboxed fallback is not successful review execution. Managed
provider policy may narrow effective access but may not silently broaden the
approved network or filesystem authority.

Provider-specific flags, domain syntax, tool restrictions, and version checks
remain behind bounded adapters. Attempts and frozen Mission review profiles
record the neutral effective policy so status, recovery, and review evidence do
not depend on private provider output. Adding another network-capable reviewer
is an adapter capability change only when it preserves these invariants;
enabling reviewer networking by default, allowing repository mutation or an
unsandboxed fallback, or making provider-private policy the sole durable record
requires explicit user notification and approval as an architecture change.

## Verification

Aligned at Git revision `d0bcad2770b1cc21ac8d250b2e456687625a1d48`
through Assignment
`00067_enable-configurable-network-access-for-codex-and`. Conformance evidence
covers `src/utils/agent-profiles.js`, `src/utils/provider-adapters.js`,
`src/utils/spawned-agent.js`, `src/utils/process-record.js`,
`src/utils/mission-execution.js`, `templates/.specdev/agents.yaml`,
`tests/test-vnext-foundations.js`, and `tests/test-mission-environment.js`; the
Assignment outcome records all three acceptance criteria and both focused
verification receipts as passed, followed by an approved independent review
with complete evidence integrity and no material, scope, or procedure
divergence.
