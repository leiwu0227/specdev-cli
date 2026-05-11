# Reduced Test Suite

SpecDev CLI intentionally keeps a compact command-level smoke/regression suite instead of one test file per source module.

The retained suite focuses on user-blocking workflow surfaces: init/update source-of-truth behavior, assignment and `.current` handling, workflow contract drift, knowledge/memory/distill basics, workflow-agent smoke coverage, approve/checkpoint gates, and reviewloop pass/fail/autocontinue behavior.

Avoid reintroducing narrow implementation-detail tests unless they protect a shipped user-facing failure mode that is not covered by a command flow.

## Source
- Assignment: 00020_refactor_reduce-test-suite
- Completed: 2026-05-11
