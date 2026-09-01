# Provider Neutrality

Status: implemented

## Decision

SpecDev's core authority model, workflow semantics, durable artifacts, recovery,
acceptance, and delivery rules are provider-neutral. No coding-agent or reviewer
provider is the source of architectural truth. Provider-specific commands,
transports, event streams, permission flags, and output parsing remain behind
bounded adapters or profiles.

Providers may offer different optional capabilities and user experiences, but
a provider integration may not weaken a core gate or make its private session
or output format necessary to understand durable project state.

Making a provider mandatory for core workflow advancement or recovery, encoding
provider-private output as the sole durable record, or granting a provider a
privileged authority bypass requires explicit user notification and approval as
an architecture change.

## Verification

Aligned at Git revision `ea92c919fc46350f6041100d89712dda9bcface9` against
`src/utils/agent-profiles.js`, `src/commands/reviewloop.js`,
`src/commands/init.js`, and `templates/.specdev/executors.yaml`.
