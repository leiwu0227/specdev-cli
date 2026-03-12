# Feature Descriptions

Running catalog of completed assignments. See `.specdev/_guides/task/validation_guide.md` (Gate 5) for update instructions.

---

## Features

### Cursor Reviewer
**Assignment:** 00002_feature_cursor-reviewer
**Completed:** 2026-03-11
**Description:** Added Cursor CLI (`cursor-agent`) as a reviewer option for the reviewloop system. Config-driven — just a JSON file, no code changes to core modules.
**Key files:** `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json`

---

## Architecture & Structure

### Discussions + .current Pointer
**Assignment:** 00003_refactor_mandatory-assignment-flag
**Completed:** 2026-03-12
**Description:** Replaced heuristic assignment auto-detection with `.current` pointer file and `specdev focus` command. Added discussions system (`D####` IDs) for pre-assignment brainstorming with promotion to assignments. Added `--type/--slug` flags for automated assignment creation, `--discussion` flag for promotion.
**Key files:** `src/commands/focus.js`, `src/commands/discussion.js`, `src/utils/current.js`, `src/utils/discussion.js`, `src/commands/assignment.js`, `src/commands/reviewloop.js`

### Specdev Discussion Skill
**Assignment:** 00004_refactor_specdev-discussion-skill
**Completed:** 2026-03-12
**Description:** Renamed `specdev discuss` CLI command to `specdev discussion` and created `.claude/skills/specdev-discussion/SKILL.md` agent skill mirroring the assignment skill pattern. Added `discussion_progress.md` to project_notes for tracking discussions.
**Key files:** `src/commands/discussion.js`, `src/commands/dispatch.js`, `.claude/skills/specdev-discussion/SKILL.md`, `.specdev/project_notes/discussion_progress.md`

---

## System Documentation

### Distill System
**Assignment:** 00001_familiarization_distill-improvement
**Completed:** 2026-03-04
**Summary:** Refactored three distill commands (`distill project`, `distill workflow`, `distill mark-processed`) into two (`specdev distill` + `specdev distill done`). Integrated distill into knowledge-capture as a hard requirement. Added distill-pending nudge to `specdev continue`.
**Key files:** `src/commands/distill.js`, `src/commands/distill-done.js`, `src/commands/continue.js`, `templates/.specdev/skills/core/knowledge-capture/SKILL.md`
