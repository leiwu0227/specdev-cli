# Reduce Test Suite

The current test suite has grown to 35 top-level `tests/test-*.js` files, with several overlapping command-level tests and one especially large `test-reviewloop-command.js` file. Full-suite runs have repeatedly exceeded practical time limits during review and capture workflows. This refactor will massively reduce the number of tests while preserving coverage for the highest-risk CLI behavior.

The selected direction is a "massive reduction" profile: keep only smoke tests and high-risk workflow coverage for initialization, assignment/current state, checkpoint/approve gates, reviewloop happy-path and failure handling, update behavior, and knowledge/distill basics. Delete or merge narrow tests that only duplicate lower-level utility behavior or assert implementation details that are already covered through command flows.
