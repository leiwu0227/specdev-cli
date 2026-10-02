# Roadmap Lane

Parent design: `./workflow_lanes.md`

Roadmap lets the user and agent define the target architecture and future work.
The user approves changes to these notes. Roadmap has no active lifecycle.
It can write Markdown under `project_notes/roadmap/designs/`, plus
`project_notes/roadmap/forecast.md` and `project_notes/roadmap/todo.md`.
Product code and all other paths remain read-only.

## Writing style

Roadmap prose uses ASD-STE100 Simplified Technical English as its default style
guide. Sentences are short and direct. Each sentence has one main idea.
Active voice is preferred, and technical terms are consistent.
Natural wording and established software terms are allowed when strict STE rules
would reduce clarity or precision. Exact paths, commands, identifiers, and code
remain unchanged.

This style applies to design notes, Forecast, Todo, drafts, and Roadmap review
comments. The aim is a practical approximation, not formal STE compliance.
An “80%” description expresses this flexibility; it is not a score or acceptance
threshold. Formal dictionary compliance is not required. Existing document
structure and word limits still apply. Existing notes adopt the style when edited;
the rule does not require a separate rewrite of all notes.

## Design notes

The design set has a hierarchy. `core_concepts.md` and
`source_code_folder_structure.md` are the two standard notes at its root.
Each other note covers one independent feature or module with minimal overlap.
Folders can show conceptual parent-child relationships. Each design Markdown file
contains at most 799 words.

Except for the folder-structure note, designs start with general concepts and then
give specific details. No fixed headings or Markdown schema are required.
Other than the two standard notes, each note can include a small folder tree or
pseudocode when useful. Each such note ends with the exact source files it targets
and the maximum total line count for each completed file.

If the user requests a separate public-function design note, Roadmap can suggest
concise typed signatures. Function names, parameters, defaults, and async forms
match the implementation or approved target. Classes use CapCase.
Named instances and returned values use `snake_case`. Each signature shows its
return type and briefly describes the returned value. The note can explain custom
types, important side effects, and failures when useful. Signatures can clarify
the design without function bodies. This optional style does not require a
`public_functions.md` file, scaffold, fixed format, or validation rule.

## Collaboration and future work

Roadmap handles one intended edit at a time unless the user explicitly authorizes
a bounded group of drafts. The agent reports the destination and scope, then waits
for approval. It writes `*_draft.md` and reports the draft path. Drafts are not
committed. After approval, the agent promotes the draft to its final path and
automatically commits the published design change.

Approved designs define the target state. Current code can contain additional
behavior. Such behavior creates neither a forecast item nor an automatic design
change. The user can separately approve its addition to the target design.

Forecast compares code with approved designs. It lists only absent or incomplete
requirements in dependency order. Each gap has one numbered section, at most
199 words, with references to its source designs. Todo records user-selected
future work outside architecture, rather than gaps derived from designs.

Roadmap grants no implementation authority. It creates no identity, graph, or
receipt and requires no exit transition.

## Source Targets

- `src/commands/roadmap.js` — maximum 140 lines — Roadmap rules and JSON/text output.
- `src/commands/init.js` — maximum 850 lines — generated Roadmap skill.
- `templates/.specdev/_guides/workflow.md` — maximum 300 lines — installed Roadmap guidance.
