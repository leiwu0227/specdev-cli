# Workflow Diff — 00020_refactor_reduce-test-suite
**Date:** 2026-05-11  |  **Assignment:** 00020_refactor_reduce-test-suite

## What Worked
- The brainstorm review caught an important ambiguity before implementation: workflow-agent coverage needed to be retained because `specdev research`, `agents inspect`, and `agent-runner` are shipped workflow primitives.
- Autocontinue carried the same Codex reviewer from brainstorm to implementation review without another approval prompt.
- Running the reduced `npm test` both locally and inside implementation review gave clear evidence that the smaller suite still passes end to end.

## What Didn't
- The implementation reviewer repeatedly tried assignment-relative paths without `.specdev/assignments/`, which added noise but did not block review.
- The original full suite had grown broad enough that reviewloop verification was expensive; reducing file count and trimming the reviewloop command test made this problem visible as a product maintenance concern rather than a one-off test failure.
