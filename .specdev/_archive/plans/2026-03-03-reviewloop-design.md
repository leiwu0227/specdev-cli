# Reviewloop Design — Rename autoloop + Add CLI Command

## Overview

Rename the "autoloop" tool skill to "reviewloop" for clarity, and add a `specdev reviewloop [phase]` CLI command to close the discoverability gap. Today there's no CLI command to trigger automated external review — users must ask the agent in conversation and hope it picks up the SKILL.md trigger.

## Non-Goals

- Content quality scoring of reviewer output
- Running the review loop from the CLI command itself (agent handles the loop)
- Migration of user-customized autoloop configs (clean delete + fresh install)

## Design

### Rename scope

Every instance of "autoloop" becomes "reviewloop":

| What | Old | New |
|------|-----|-----|
| Skill dir | `skills/tools/autoloop/` | `skills/tools/reviewloop/` |
| Script | `scripts/autoloop.sh` | `scripts/reviewloop.sh` |
| SKILL.md name | `autoloop` | `reviewloop` |
| Env vars | `$AUTOLOOP_*` | `$REVIEWLOOP_*` |
| Reviewer config ref | `"$AUTOLOOP_PROMPT"` | `"$REVIEWLOOP_PROMPT"` |
| OFFICIAL_TOOL_SKILLS | `['autoloop']` | `['reviewloop']` |
| Tests | `test-autoloop-*` | `test-reviewloop-*` |
| package.json scripts | `test:autoloop-*` | `test:reviewloop-*` |
| Brainstorming SKILL.md | "autoloop tool skill" | "reviewloop tool skill" |

### CLI command — `specdev reviewloop [phase]`

New command in `src/commands/reviewloop.js`. Signal-to-agent pattern (same as `specdev review`):

1. Validate phase (`brainstorm | implementation`)
2. Resolve assignment path
3. Check artifacts exist for the phase
4. Scan `reviewers/*.json` to list available reviewers
5. Print agent instructions (which reviewer, how to run the script, the fix loop)

Registered in `dispatch.js`, added to `help.js` workflow section.

### Update/migration

- `OFFICIAL_TOOL_SKILLS = ['reviewloop']`
- `specdev update` removes old `skills/tools/autoloop/` directory if present
- Fresh install of `reviewloop/` as official tool skill
- No rename logic, no config migration

### Tests

- Rename test files: `test-autoloop-*` → `test-reviewloop-*`
- Update all internal references (paths, env vars, script name, skill name)
- Update `test-checkpoint-tools.js` and `test-update-skills.js` references
- Update `package.json` test script names

## Success Criteria

- `specdev reviewloop brainstorm` prints reviewer list and agent instructions
- `specdev reviewloop implementation` prints reviewer list and agent instructions
- All renamed tests pass
- `specdev update` removes old autoloop/ and installs reviewloop/
- No remaining references to "autoloop" in source (except docs/plans history)
