---
name: specdev-roadmap
description: Collaborate on user-approved roadmap notes without workflow state
---

Use Roadmap only when the user explicitly selects it. Run `specdev roadmap
--json` to display the writable boundary, standard files, and stateless rules.
Read the current roadmap as needed, but treat product code and every path
outside these locations as read-only:

- Direct Markdown files under `.specdev/project_notes/roadmap/designs/`
- `.specdev/project_notes/roadmap/forecast.md`

Every Markdown file under `roadmap/designs/` must contain fewer than 800
words (maximum 799). `core_concepts.md` and
`source_code_folder_structure.md` are the standard cross-cutting notes. Every
other design note must cover one independent feature or module and minimize
overlap with the standard notes and its peers.

`forecast.md` is a future-work roadmap. When creating or revising it, quickly
inspect current code read-only against the Roadmap designs, identify design-note
sections not yet reflected in code, and list those gaps in dependency order.
Write each gap as its own Markdown section containing fewer than 200 words
(maximum 199).

Collaborate with the user on one exact candidate edit at a time. Show the exact
destination and complete proposed content or diff, then wait for explicit user
approval before writing. Invocation alone never authorizes a write. Roadmap
creates no ID, RippleGraph state, receipt, snapshot, or automatic commit, and it
does not grant authority to implement forecast items.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
