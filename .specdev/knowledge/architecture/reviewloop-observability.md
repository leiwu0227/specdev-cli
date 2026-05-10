# Reviewloop Observability

Assignment `00015_feature_claude-reviewer-observability` split reviewloop subprocess mechanics from reviewloop policy.

Pattern: keep child lifecycle, heartbeat timers, timeout handling, and capped stdout capture in `src/utils/reviewer-runner.js`. Keep artifact policy in `src/commands/reviewloop.js`: log header/footer formatting, feedback parsing, strict stdout salvage, stream-json sidecar paths, and verdict handling.

The runner's heartbeat is based on user-visible activity, not raw child bytes. Handlers call `markActivity()` only when they emit something visible to the user. This prevents invisible chunks, partial JSONL lines, or suppressed stream-json events from postponing heartbeat output.

Timeout cleanup kills the entire reviewer process group with `SIGTERM`, schedules a 5s `SIGKILL` grace timer, and unrefs that grace timer so the CLI can resolve immediately without the grace window keeping Node alive.

Claude reviewer output uses `--output-format stream-json --verbose` with `stream_json: true`. Reviewloop renders safe progress into the normal reviewer log and stores raw JSONL in `review/{phase}-reviewer-{name}-round-N.jsonl`. Strict stdout salvage remains plain-text only.
