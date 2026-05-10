## Round 1

- Addressed [F1.1] by changing strict stdout salvage to check whether the expected review round exists, rather than only checking whether any latest round exists. Added a regression for salvaging `## Round 2` when round 1 already exists.
- Addressed [F1.2] by unrefing the grace-period `SIGKILL` timer after timeout, so the promise can resolve without the timer keeping the CLI process alive. Added runner test coverage for the unref behavior.
