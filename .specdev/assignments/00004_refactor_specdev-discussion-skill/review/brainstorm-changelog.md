## Round 1

### [F1.1] Missing doc files in rename list
**Action:** Added `.specdev/_main.md`, `.specdev/_index.md`, `templates/.specdev/_index.md`, and `templates/.specdev/_main.md` to the files-to-change list in section 1.

### [F1.2] Skill placement underspecified
**Action:** Added explicit explanation in section 2 distinguishing `.claude/skills/` (Claude Code agent skills, local to this repo) from `.specdev/skills/` (workflow skills, templated into new projects). Clarified in section 4 that the skill file is NOT templated.

### [F1.3] Backward-compatibility not addressed
**Action:** Added explicit statement in section 1: no backward-compatibility alias. Old `specdev discuss` is hard-removed — this is an internal tool with no external consumers, so a clean break is appropriate. Users get standard "Unknown command" error and can check `specdev help`.
