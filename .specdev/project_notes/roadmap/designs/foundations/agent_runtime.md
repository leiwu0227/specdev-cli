# Agent Runtime

Parent design: `./coding_agent_role.md`

The agent runtime executes one bounded Attempt while protecting repository state and
translating provider behavior into a deterministic SpecDev result.

An invocation resolves a frozen profile, constructs a role-specific prompt, chooses
stdin or argument transport, and spawns the provider without a shell. It captures
bounded stdout and stderr, streams progress when supported, and terminates the whole
process group on timeout or interruption. Raw provider output remains operational;
the durable workflow receives only validated artifacts and a strict result envelope.

Before execution, the runtime records an Attempt and a local process marker. During
execution, status and progress are updated without changing workflow authority. At
completion it validates required Markdown sections and the role envelope, retries
only permitted formatting failures, and records a provider-neutral outcome. Stale
or dead process markers are recoverable; a live or ambiguous writer blocks unsafe
replacement.

Worker execution may mutate only its delegated product scope. Reviewer execution
computes repository digests before and after invocation and reports any product
write as a violation. Candidate roots and exclusions are explicit so reviewer
artifacts do not masquerade as product changes.

The runtime supports plain output and structured event streams, but event schemas,
session IDs, usage fields, and provider diagnostics are adapters rather than core
workflow truth. Captures are size-bounded, secrets are not promoted into durable
artifacts, and loss of raw logs does not erase accepted evidence.

Conceptually:

```text
resolve profile -> record Attempt -> spawn process -> capture bounded output
  -> validate role result -> protect repository -> persist semantic outcome
```

## Source Targets

- `src/utils/spawned-agent.js` — maximum 900 lines — process execution, capture, and repository protection.
- `src/utils/result-envelope.js` — maximum 260 lines — strict provider-neutral result contracts.
- `src/utils/process-record.js` — maximum 340 lines — Attempt and local-process lifecycle.
- `src/utils/attempt-progress.js` — maximum 310 lines — bounded progress projection.
