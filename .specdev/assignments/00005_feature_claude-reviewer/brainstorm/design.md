# Design: Claude Reviewer

## Overview

Add a `claude.json` reviewer configuration that launches Claude Code with `--dangerously-skip-permissions` for fully automated reviews via `specdev reviewloop`.

## Goals

- Enable `specdev reviewloop <phase> --reviewer=claude` to launch Claude Code as an external reviewer
- Distribute the config to all new projects via `specdev init`

## Non-Goals

- No code changes to the reviewer system (it's already pluggable)
- No model-specific variants (e.g., claude-sonnet) — just the default claude config

## Design

### Reviewer Config

File: `claude.json`

```json
{
  "name": "claude",
  "command": "claude --dangerously-skip-permissions -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

### File Locations

1. `.specdev/skills/core/reviewloop/reviewers/claude.json` — local project config
2. `templates/.specdev/skills/core/reviewloop/reviewers/claude.json` — distributed via `specdev init`

### How It Works

The existing `reviewloop` command:
1. Reads all `.json` files from the reviewers directory
2. `checkReviewerCLIs()` extracts the first word of the command (`claude`) and checks `which claude`
3. On execution, spawns `bash -c "<command>"` with `SPECDEV_PHASE`, `SPECDEV_ROUND`, and `SPECDEV_ASSIGNMENT` env vars

No changes to any of this — the new config just plugs in.

## Success Criteria

1. `specdev reviewloop <phase> --reviewer=claude` successfully launches Claude Code
2. Claude Code receives the correct review prompt with phase and round substituted
3. `specdev init` copies `claude.json` to new projects
4. Existing tests continue to pass
