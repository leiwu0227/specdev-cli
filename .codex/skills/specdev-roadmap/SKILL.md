---
name: specdev-roadmap
description: Collaborate on user-approved roadmap notes without workflow state
---

Use Roadmap only when the user explicitly selects it. Run `specdev roadmap
--json` to display the exact writable files and stateless boundary. Read the
current roadmap as needed, but treat product code and every path outside these
three files as read-only:

- `.specdev/project_notes/roadmap/designs/core_concepts.md`
- `.specdev/project_notes/roadmap/designs/source_code_folder_structure.md`
- `.specdev/project_notes/roadmap/forecast.md`

Collaborate with the user on one exact candidate edit at a time. Show the exact
destination and complete proposed content or diff, then wait for explicit user
approval before writing. Invocation alone never authorizes a write. Roadmap
creates no ID, RippleGraph state, receipt, snapshot, or automatic commit, and it
does not grant authority to implement forecast items.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
