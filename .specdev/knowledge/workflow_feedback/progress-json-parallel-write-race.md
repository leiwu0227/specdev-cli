# Progress JSON Parallel Write Race

Status: open
Type: issue
Severity: moderate
First seen: 2026-05-11, 00019_feature_autocontinue-reviewloop
Last seen: 2026-05-11, 00019_feature_autocontinue-reviewloop
Assignments observed: 00019_feature_autocontinue-reviewloop

## Observation
- Running multiple `complete-task.sh` commands in parallel caused one process to read partially written `implementation/progress.json`, producing a JSON parse error.

## Impact
- Agents may leave task progress in an inconsistent state or lose summaries if they parallelize progress script calls.

## Current Mitigation
- Run `prepare-task.sh`, `complete-task.sh`, and `track-progress.sh` sequentially. Do not wrap progress writes in parallel tool calls.
- If a write race occurs, inspect `implementation/progress.json`, repair missing task summaries/statuses, then rerun `track-progress.sh <plan> summary`.

## Proposed Action
- update-guidance
