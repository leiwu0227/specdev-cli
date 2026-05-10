# Proposal

Improve Claude reviewer observability and reliability in `specdev reviewloop`.

## Problem

Real Claude reviewer runs can appear stuck because `claude --print` often stays silent until it finishes. Reviewloop now prints the live reviewer log path, but during Claude's quiet period the log may contain only the command header. Claude can also still time out or finish without writing the required review artifact.

## Goal

Design a more observable and reliable Claude reviewer path so users can tell whether Claude is still running, diagnose stdout-only/missing-artifact failures, and reduce avoidable timeouts without changing the core review artifact contract.

## Starting Notes

Known current behavior:
- Claude reviewer config uses `claude-opus-4-6[1m]`, `--effort high`, `--fallback-model sonnet`, `--print`, and a 1200s timeout.
- Reviewloop passes `SPECDEV_FEEDBACK_FILE` and `SPECDEV_CHANGELOG_FILE`.
- Reviewloop prints the reviewer log path before spawning the reviewer.
- In a real smoke test, Claude emitted no intermediate output until completion, then wrote `review/brainstorm-feedback.md` and passed.

Potential areas to explore:
- Heartbeat/progress output while the child process is alive but quiet.
- Better failure diagnostics when the reviewer exits without appending a verdict.
- Whether `--output-format stream-json` can provide useful lifecycle events without destabilizing artifact parsing.
- Whether log files should record start time, elapsed time, command env summary, and final status.
