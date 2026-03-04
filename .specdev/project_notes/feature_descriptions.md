# Feature Descriptions

Running catalog of completed assignments. See `.specdev/_guides/task/validation_guide.md` (Gate 5) for update instructions.

---

## Features

*(Updated by feature assignments)*

---

## Architecture & Structure

*(Updated by refactor assignments)*

---

## System Documentation

### Distill System
**Assignment:** 00001_familiarization_distill-improvement
**Completed:** 2026-03-04
**Summary:** Refactored three distill commands (`distill project`, `distill workflow`, `distill mark-processed`) into two (`specdev distill` + `specdev distill done`). Integrated distill into knowledge-capture as a hard requirement. Added distill-pending nudge to `specdev continue`.
**Key files:** `src/commands/distill.js`, `src/commands/distill-done.js`, `src/commands/continue.js`, `templates/.specdev/skills/core/knowledge-capture/SKILL.md`
