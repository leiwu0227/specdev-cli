# Cursor Reviewer Design

## Overview

Add Cursor CLI (`cursor-agent`) as a reviewer option for specdev's reviewloop system, following the same JSON config pattern as the existing Codex reviewer.

## Background

- The reviewloop architecture is configuration-driven: each reviewer is a JSON file in `.specdev/skills/core/reviewloop/reviewers/`
- Currently only Codex is configured
- Cursor CLI (`cursor-agent`) supports non-interactive mode via `-p` flag and full-auto via `-f`
- Known upstream issue: cursor-agent sometimes hangs after completion (GitHub #3588), but dry-run testing on current system showed clean exits

## Goals

- Allow users to select Cursor as a reviewer via `specdev reviewloop <phase> --reviewer=cursor`
- `cursor-agent` binary auto-detected during `specdev init` (via existing config-driven discovery)
- Follow existing reviewer config conventions exactly

## Non-Goals

- No changes to `reviewloop.js` or reviewer architecture
- No wrapper scripts or hang-detection logic (hang is intermittent, not observed locally)
- No timeout mechanism (can be added later if needed)

## Success Criteria

- `cursor.json` config exists in `templates/.specdev/skills/core/reviewloop/reviewers/`
- `specdev init` auto-detects cursor-agent via existing config-driven discovery (no code changes)
- Existing tests pass; new test cases in `test-reviewloop.js` and `test-reviewloop-command.js` cover cursor config installation, reviewer listing, and `checkReviewerCLIs` detection

## Design

### 1. Reviewer config

Add `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`:

```json
{
  "name": "cursor",
  "command": "cursor-agent -f -p \"Run specdev review $SPECDEV_PHASE --assignment $SPECDEV_ASSIGNMENT --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

### 2. CLI detection

No code changes needed. `src/utils/reviewers.js` already auto-discovers all reviewer JSON configs and extracts the binary from the first word of the `command` field. Adding `cursor.json` with `cursor-agent` as the command binary is sufficient — `specdev init` will automatically detect and report its availability.

### 3. Testing

Concrete test targets in existing test files:

- **`tests/test-reviewloop.js`**: Assert `cursor.json` is installed to `.specdev/skills/core/reviewloop/reviewers/` after `specdev init`
- **`tests/test-reviewloop-command.js`**: Assert that when `cursor.json` exists in the reviewers directory, `specdev reviewloop <phase>` lists `cursor` as an available reviewer
- **`checkReviewerCLIs` coverage**: Assert that `checkReviewerCLIs` returns an entry with `{ name: 'cursor', binary: 'cursor-agent' }` when `cursor.json` is present in the fixtures
