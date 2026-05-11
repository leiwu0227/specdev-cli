## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] CRITICAL: `runAgentProcess` resolves the timeout result immediately after sending `SIGTERM`, before the child process has exited or the 5s `SIGKILL` grace has completed ([src/utils/agent-runner.js](/mnt/h/oceanwave/lib/specdev-cli/src/utils/agent-runner.js:200)). Because the stdout listeners remain attached while `runAgent` then closes the artifact streams, a timed-out researcher can keep running briefly and continue writing after the command has already returned. That breaks the intended process-group timeout contract for external agent CLIs and can leave artifact contents racing with command completion. Consolidate this with the process lifecycle: mark timed out on deadline, send `SIGTERM`, schedule `SIGKILL`, and resolve only from `close` or a single controlled finalization path after the process is actually gone.
2. [F1.2] MINOR: `validateRequiredSections` checks only that the required H2 sections exist, but the researcher spec requires them "in order" ([src/utils/agent-runner.js](/mnt/h/oceanwave/lib/specdev-cli/src/utils/agent-runner.js:86)). This lets invalid agent output pass validation and weakens the contract that downstream workflow steps consume. The simplest fix is to scan H2 positions for the configured section list and reject missing or out-of-order headings.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** approved

### Findings
1. (none)

### Addressed from changelog
- [F1.1] Timeout handling now waits for child close before resolving, keeps the SIGTERM/SIGKILL grace path coordinated, and is covered by `tests/test-agent-runner.js`.
- [F1.2] Required markdown section validation now rejects out-of-order headings and is covered by `tests/test-agent-runner.js`.
