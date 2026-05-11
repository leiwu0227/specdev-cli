# Plan Skills Bracket Parsing

Status: open
Type: issue
Severity: moderate
First seen: 2026-05-07, 00008_feature_workflow-status-json
Last seen: 2026-05-11, 00019_feature_autocontinue-reviewloop
Assignments observed: 00008_feature_workflow-status-json, 00019_feature_autocontinue-reviewloop

## Observation
- Implementation progress scripts parse `**Skills:** [test-driven-development]` as the literal skill name `[test-driven-development]`, producing a warning even though the intended skill exists.
- Assignment 00019 reproduced this in `prepare-task.sh` output for plan tasks that followed the bracketed breakdown template.

## Impact
- Agents may think required skills are missing even when they are installed, and task prompts omit useful skill instructions.

## Current Mitigation
- Write plan skill lines without brackets, e.g. `**Skills:** test-driven-development`.
- When a prepared task shows `Warning: skill not found: [test-driven-development]`, manually read and follow the intended skill.

## Proposed Action
- update-guidance
