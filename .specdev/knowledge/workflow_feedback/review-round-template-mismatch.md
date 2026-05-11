# Review Round Template Mismatch

Status: open
Type: issue
Severity: minor
First seen: 2026-05-11, 00017_refactor_workflow-architecture
Last seen: 2026-05-11, 00017_refactor_workflow-architecture
Assignments observed: 00017_refactor_workflow-architecture

## Observation
- `specdev review implementation --round 2` displayed an automated review feedback template that still said `## Round 1`, even though the command was invoked for Round 2.

## Impact
- Reviewers may write the wrong round header if they follow the printed template literally. Reviewloop depends on round headers to process feedback and stale-finding guards.

## Current Mitigation
- Treat the explicit `--round N` invocation and reviewloop round banner as authoritative. Append `## Round N`, not the stale example block, when the printed template disagrees.

## Proposed Action
- update-guidance
