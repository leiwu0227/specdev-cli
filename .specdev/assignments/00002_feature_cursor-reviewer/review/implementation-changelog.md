## Round 1

### Changes
- [F1.1] Verified: all 46 tests pass locally (`node tests/test-reviewloop-command.js` → 46 passed, 0 failed). The 20 failures codex reported were due to its sandboxed environment (restricted shell, missing binaries), not actual test regressions. Full test suite (`npm test`) also passes with exit code 0.
