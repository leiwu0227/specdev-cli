## Round 1

- [F1.1] Changed `runAgentProcess` timeout handling so the timeout path marks the process as timed out, sends `SIGTERM`, schedules the unrefed `SIGKILL` grace timer, and resolves only from the child `close` event. Added a focused agent-runner test proving timeout does not resolve before child close and still uses process-group termination.
- [F1.2] Changed `validateRequiredSections` to reject required H2 sections that appear out of order, and added focused section-order coverage.

Verification:
- `npm run test:agent-runner`
- `npm run test:research`
- `npm run test:agent-runner-subsumption`
