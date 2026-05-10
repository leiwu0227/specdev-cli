# Workflow Diff - 00015_feature_claude-reviewer-observability
**Date:** 2026-05-10  |  **Assignment:** 00015_feature_claude-reviewer-observability

## What Worked
- The reviewloop implementation review found two concrete regressions that normal task execution missed: later-round stdout salvage was gated on "no latest round" instead of "expected round missing", and the timeout grace `SIGKILL` timer stayed referenced after the CLI resolved.
- The `implementation-changelog.md` artifact made Round 2 review efficient; the reviewer could verify exact dispositions for [F1.1] and [F1.2] without re-deriving intent from commits.
- The task plan's explicit runner/policy split mapped cleanly to tests: runner fake-clock tests covered heartbeat and timeout ownership, while command tests covered reviewloop artifact behavior and stream-json sidecars.

## What Didn't
- The mandatory `specdev knowledge search` step failed even after `specdev knowledge index` rebuilt the generated cache: SQLite reported `no such column: json`. Direct markdown inspection was needed as a fallback.
- Reviewloop review logs are useful but large; Round 2 produced a 130KB+ log for a targeted review. That is acceptable for diagnostics, but future summaries should continue to rely on feedback/changelog artifacts instead of reading logs by default.
- Assignment `00015` was implementation-approved after `00016` had already been completed, so capture had to insert catalog rows out of numeric order. The workflow tolerates this, but progress views should make out-of-order completion unsurprising.
