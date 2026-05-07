# Proposal: Reviewer Preflight Checks

Add a preflight path for `specdev reviewloop` so users can verify reviewer configuration and obvious runtime problems before an external reviewer process is spawned.

This follows the Hermes lesson that agent workflows should expose observable readiness checks before expensive or long-running tool execution.
