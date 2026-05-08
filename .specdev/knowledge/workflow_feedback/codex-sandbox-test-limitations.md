# Codex Sandbox Test Limitations

Codex's sandboxed environment cannot capture `spawnSync` stdout/stderr when running specdev CLI tests. This causes `test-reviewloop-command.js` (and likely other test files using the same pattern) to report false failures during `specdev reviewloop implementation --reviewer=codex`.

**Impact:** Codex implementation reviews will always flag test failures even when all tests pass locally. Users should verify tests locally and use `specdev approve implementation` when codex reports sandbox-related false failures.

**Root cause:** The codex sandbox restricts child process I/O capture. The CLI outputs correctly when run directly, but `spawnSync` receives empty stdout/stderr streams.
