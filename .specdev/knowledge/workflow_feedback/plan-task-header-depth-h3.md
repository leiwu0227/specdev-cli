# Plan Task Header Depth (H3 Required)

Status: resolved
Type: issue
Severity: minor
First seen: 2026-04-25, oceanlive-cli/00007–00014
Last seen: 2026-04-25
Assignments observed: oceanlive-cli/00007, /00011, /00012, /00014

## Observation

`extract-tasks.sh` and `track-progress.sh` parse `^### Task [0-9]` (H3). A plan
written with `## Task N:` (H2) silently returns zero tasks; the first
`track-progress.sh ... started` call then crashes with
`TypeError: Cannot read properties of undefined (reading 'find')` because
`tasks.find(...)` runs against an empty array. Fix: re-headerise the plan and
delete `progress.json` so lazy-init regenerates it.

## Impact

Silent zero-task state is a confusing failure mode for first-time authors;
recurred four times in one downstream project.

## Current Mitigation

Resolved. `templates/.specdev/skills/core/breakdown/SKILL.md` (around line 66)
now makes the H3 requirement explicit: "Every task MUST be an H3 heading
(`### Task N: …`). The breakdown scripts grep for `^### Task [0-9]` — H2
silently produces zero tasks and breaks downstream tracking."

## Proposed Action

none. Optional follow-up: also fail loud in `track-progress.sh` when
`TASK_COUNT == 0` (Option C from the original learning note) so existing
plans surface the issue without re-reading the skill.
