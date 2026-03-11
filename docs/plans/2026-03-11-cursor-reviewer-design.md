# Cursor Reviewer Design

## Summary

Add Cursor CLI (`cursor-agent`) as a reviewer option for specdev's reviewloop system, following the same JSON config pattern as the existing Codex reviewer.

## Background

- The reviewloop architecture is configuration-driven: each reviewer is a JSON file in `.specdev/skills/core/reviewloop/reviewers/`
- Currently only Codex is configured
- Cursor CLI (`cursor-agent`) supports non-interactive mode via `-p` flag and full-auto via `-f`
- Known upstream issue: cursor-agent sometimes hangs after completion (GitHub #3588), but dry-run testing on current system showed clean exits

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

Add `cursor-agent` to the binary check list in `src/utils/reviewers.js` so `specdev init` reports whether cursor is installed and available.

### 3. Testing

- Config validation: cursor.json loads correctly and has required fields
- CLI detection: `cursor-agent` appears in reviewer availability checks

### Non-goals

- No changes to `reviewloop.js` or reviewer architecture
- No wrapper scripts or hang-detection logic (hang is intermittent, not observed locally)
- No timeout mechanism (can be added later if needed)
