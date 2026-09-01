---
name: specdev-roadmap
description: Collaborate on user-approved roadmap notes without workflow state
---

Use Roadmap only when the user explicitly selects it. Run `specdev roadmap
--json` to display the writable boundary, standard files, and stateless rules.
Read the current roadmap as needed, but treat product code and every path
outside these locations as read-only:

- Markdown files recursively under `.specdev/project_notes/roadmap/designs/`
- `.specdev/project_notes/roadmap/forecast.md`

Every Markdown file under `roadmap/designs/` must contain fewer than 800
words (maximum 799). `core_concepts.md` and
`source_code_folder_structure.md` are the standard cross-cutting notes. Every
other design note must cover one independent feature or module and minimize
overlap with the standard notes and its peers. Keep the standard notes at the
designs root; other notes may use folders that mirror their conceptual
parent-child hierarchy.

Design notes describe high-level stable abstractions, general concepts,
reusable conceptual templates, deliberate design choices, and their tradeoffs.
Use examples where they make the intended design obvious, but do not reproduce
implementation details. Keep runtime mechanics, verification history, and
incidental source-code references out of conceptual design notes. The design
set retains stable abstractions and deliberate tradeoffs rather than duplicating
the code.

`forecast.md` is a future-work roadmap. When creating or revising it, quickly
inspect current code read-only against the Roadmap designs, identify design-note
sections not yet reflected in code, and list those gaps in dependency order.
Write each gap as its own Markdown section containing fewer than 200 words
(maximum 199).

Treat approved designs as the target state: identify code gaps versus the
designs, never design gaps versus current code. Current code may be a superset
of the designs; extra code-only features do not create forecast items or
automatic design-note updates. The user separately initiates Roadmap
collaboration to incorporate such features into the design notes.

Collaborate with the user on one intended edit at a time. Before drafting,
report the exact destination and a concise scope, then wait for explicit user
approval to write within that agreed direction. After writing, report only its
Markdown path so the user can inspect it; do not echo the full document or diff
unless the user asks. Invocation alone never authorizes a write. Roadmap
creates no ID, RippleGraph state, receipt, snapshot, or automatic commit, and it
does not grant authority to implement forecast items.

Roadmap has no active lifecycle. It applies only while the user is explicitly
collaborating on roadmap notes. Selecting another lane immediately supersedes
Roadmap collaboration; no exit command or state transition is required.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
