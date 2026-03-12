# Design: Rename specdev discuss → specdev discussion + agent skill

## Overview

Align the discussion workflow with the assignment workflow: a CLI command for ID reservation and folder creation, plus an agent skill that orchestrates the brainstorming process. Rename `discuss` to `discussion` throughout.

## Non-Goals

- Changing the review/checkpoint/reviewloop CLI flows for discussions
- Changing how discussions are promoted to assignments (`--discussion=<id>`)
- Adding breakdown/implementation phases to discussions
- Changing the brainstorming skill itself

## Design

### 1. Rename CLI command: `discuss` → `discussion`

**Files to change:**
- `src/commands/discuss.js` → rename to `src/commands/discussion.js`
- `src/commands/dispatch.js` — change route from `discuss` to `discussion`
- `src/commands/help.js` — update help text
- `.specdev/_guides/workflow.md` — update references
- `.specdev/_main.md` — update `specdev discuss` reference in First Steps
- `.specdev/_index.md` — update command reference table entries
- `templates/.specdev/_guides/workflow.md` — update references
- `templates/.specdev/_index.md` — update command reference table entries
- `templates/.specdev/_main.md` — update First Steps reference
- `src/commands/review.js` line 49 — error message string `'Use specdev discuss --list'` → `'Use specdev discussion --list'`
- `src/commands/reviewloop.js` line 44 — error message string `'Use specdev discuss --list'` → `'Use specdev discussion --list'`
- `src/commands/checkpoint.js` line 30 — error message string `'Use specdev discuss --list'` → `'Use specdev discussion --list'`
- CLI output in `src/commands/discuss.js` (after rename to `discussion.js`) — update usage strings from `specdev discuss` to `specdev discussion`

**No backward-compatibility alias.** The old `specdev discuss` command is intentionally hard-removed. This is an internal tool with no external consumers — a clean break is simpler than maintaining a deprecation path. If someone runs `specdev discuss`, they get the standard "Unknown command" error and can check `specdev help` for the correct name.

The `discussCommand` function and `discussion.js` utility module stay named as-is internally — only the CLI-facing name changes.

### 2. Create agent skill: `.claude/skills/specdev-discussion/SKILL.md`

**Placement:** The skill lives in `.claude/skills/specdev-discussion/SKILL.md` — this is a Claude Code skill directory, local to this repo. It is NOT part of the `.specdev/skills/` template system. The `.claude/skills/` directory contains agent-facing skills that Claude Code loads as slash commands (e.g., `/specdev-assignment`, `/specdev-review`). These are specific to the specdev-cli repo itself, not templated into new projects via `specdev init`. The `.specdev/skills/` directory is a different system — those are workflow skills that the brainstorming/breakdown/implementation processes follow.

Mirror the `specdev-assignment` skill pattern:

```markdown
---
name: specdev-discussion
description: Start a parallel brainstorming discussion
---

Run `specdev discussion "<description>"` to reserve a discussion ID.

Read the output to get the reserved ID and folder path, then:
1. Follow `.specdev/skills/core/brainstorming/SKILL.md` exactly, writing artifacts to the discussion's brainstorm/ folder
2. After creating the discussion, add a row to `.specdev/project_notes/discussion_progress.md`

Announce every subtask with "Specdev: <action>".
```

### 3. Add `discussion_progress.md` to `.specdev/project_notes/`

**Who maintains it:** The agent manually adds/updates rows, same as `assignment_progress.md`. The CLI command does NOT auto-populate this file. The `specdev-discussion` skill instructions should tell the agent to add a row after creating a discussion, and update it when the discussion status changes.

Mirror the structure of `assignment_progress.md`:

```markdown
# Discussion Progress

Below is a list of discussions and their status.

## Format

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|

**Status Values:**
- **Active**: Brainstorming in progress
- **Complete**: Brainstorm finished, not yet promoted
- **Promoted**: Converted to an assignment
- **Abandoned**: Discussion dropped

## Discussions

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|

## Instructions

1. When creating a new discussion, add a row with the discussion ID (D0001 format)
2. Update status as the discussion progresses
3. When promoted, record the assignment ID in the "Promoted To" column
4. Use Notes column for context or abandonment reasons
```

### 3a. Existing discussion artifacts

Existing `.specdev/discussions/` folders created by the old `specdev discuss` command continue to work as-is. The folder format and internal structure are unchanged — only the CLI command name changes. No migration needed.

### 4. Add to templates

- Add `discussion_progress.md` to `templates/.specdev/project_notes/` so `specdev init` includes it
- The skill file (`.claude/skills/specdev-discussion/SKILL.md`) is NOT templated — it is local to the specdev-cli repo only. The `.claude/skills/` directory is not part of the `specdev init` template system.

### 5. Update tests

- Rename/update `tests/test-discuss.js` to cover `specdev discussion`
- Update any test that invokes `specdev discuss` to use `specdev discussion`
- Verify `--list`, `--json`, and description positional args still work
- Output format for `--list` and `--json` is unchanged — this is a pure rename with no behavior change

## Key Decisions

1. **Internal function names stay as-is** — `discussCommand`, `discussion.js` utils don't need renaming since they're already discussion-themed
2. **Skill mirrors assignment pattern exactly** — call CLI for ID, then follow brainstorming skill
3. **discussion_progress.md uses "Promoted To" column** — links discussions to assignments when promoted
4. **No backward-compatibility alias** — hard-remove `specdev discuss`, no deprecation warning. Internal tool, no external consumers.
5. **discussion_progress.md is agent-maintained** — the CLI doesn't auto-populate it; the agent skill tells the agent to update it manually, same pattern as `assignment_progress.md`
6. **Existing discussion folders are unaffected** — the rename only changes the CLI command name, not the folder structure or artifact format

## Success Criteria

1. `specdev discussion "topic"` creates a discussion folder (old `specdev discuss` command gone)
2. `.claude/skills/specdev-discussion/SKILL.md` exists at correct path with correct frontmatter
3. `discussion_progress.md` exists in `.specdev/project_notes/` and `templates/.specdev/project_notes/`
4. All references to `specdev discuss` updated to `specdev discussion` (grep for `specdev discuss` returns zero hits outside of git history)
5. All existing tests pass after the rename
6. Promotion path (`specdev assignment --discussion=<id>`) still works
