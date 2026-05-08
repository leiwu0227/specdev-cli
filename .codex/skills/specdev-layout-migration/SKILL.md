---
name: specdev-layout-migration
description: Guide an agent through a safe, user-approved .specdev layout migration
---

Read `.specdev/_guides/migration_guide.md`.

Follow the guide as an interactive migration workflow:

1. Inspect the existing `.specdev/` tree without moving files.
2. Classify artifacts against the modern structure.
3. Write `.specdev/migration/layout-plan.md` with proposed moves, files to leave in place, and questions for the user.
4. Ask the user to approve the plan before editing.
5. Apply only approved moves, preserving content and avoiding overwrites.
6. Verify with `specdev status --json` and summarize what changed.

If the user only needs the old deterministic assignment-file migration, discuss `specdev migrate legacy-assignments --dry-run` first.

Announce every subtask with "Specdev: <action>".
