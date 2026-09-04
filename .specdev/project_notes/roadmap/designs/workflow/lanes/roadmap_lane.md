# Roadmap Lane

Parent design: `./workflow_lanes.md`

Roadmap is stateless user-approved collaboration on durable target architecture and
the future implementation gaps derived from it. It may write only Markdown under
`project_notes/roadmap/designs/` and `forecast.md`; product code and all other paths
remain read-only.

The design set is hierarchical. `core_concepts.md` and
`source_code_folder_structure.md` are standard cross-cutting notes at the root. Each
other note owns one independent feature or module with minimal overlap and may live
in folders that mirror conceptual parent-child relationships. Every design Markdown
file contains at most 799 words.

Except for the folder-structure note, designs explain general concepts before more
specific detail without requiring fixed headings or a Markdown schema. Non-standard
notes may use a small relevant folder tree or pseudocode when helpful. They end by
identifying exact targeted source files and a maximum total completed-file line count
for each. The two standard notes are exempt from that ending metadata.

Roadmap collaborates on one intended edit at a time unless the user explicitly
authorizes a bounded bulk draft. The agent reports destination and scope, waits for
approval, writes `*_draft.md`, and reports the draft path. Drafts are not committed.
After approval, the draft is promoted to its final path and the published design
change is automatically committed.

Designs are the approved target state. Current code may be a superset; code-only
behavior creates neither a forecast item nor an automatic design rewrite. The user
may separately approve incorporating that behavior into the target design.

The forecast compares code against approved designs, lists only absent or incomplete
requirements, orders gaps by dependency, and uses one numbered section of at most
199 words per gap with source-design references. Roadmap never grants implementation
authority and has no identity, graph, receipt, or exit transition.

## Source Targets

- `src/commands/roadmap.js` — maximum 140 lines — stateless Roadmap contract and JSON/text projection.
- `src/commands/init.js` — maximum 850 lines — canonical generated Roadmap skill.
- `templates/.specdev/_guides/workflow.md` — maximum 300 lines — installed Roadmap lifecycle guidance.
