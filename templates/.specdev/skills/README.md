# SpecDev skills

Core skills are compact reference guidance. Static RippleGraph packages and
semantic CLI commands own lifecycle transitions and durable state.

Request routing is deliberately outside the graph: Direct questions,
inspection, and small non-behavioral documentation writes create no state,
receipt, or automatic commit; explicitly user-selected Roadmap collaboration is
stateless and restricted to `roadmap/forecast.md`, `roadmap/todo.md`, and
bounded design Markdown files after exact user approval. Forecast treats designs
as the target and lists only absent or incomplete code in dependency order,
limited to fewer than 200 words per numbered Markdown section, with each section
citing the Roadmap design note or notes it is based on. Todo records
user-selected non-architecture future work in dependency order followed by user
priority, using the same numbered-section format and word limit but omitting
provenance. Neither list grants implementation authority. Code may be a
superset; code-only features do not create forecast items or automatic design
updates. Design notes are drafted as
`*_draft.md`, reported by path only, promoted to final `.md` only after user
approval, and automatically committed when published. Except for
`source_code_folder_structure.md`, their prose moves from general descriptions
toward more specific detail without a prescribed Markdown format. Notes other
than `core_concepts.md` and `source_code_folder_structure.md` end by identifying
their targeted source files and the maximum total completed-file line count for
each, and may include a small relevant folder tree or pseudocode when helpful.
Neither illustration is required. Roadmap has no active lifecycle; selecting
another lane immediately supersedes it without an exit command or state
transition. Explicitly user-selected Adhoc work creates one receipt and final
commit but no RippleGraph run.

- `brainstorming`: interactive contract or Discussion authoring.
- `reviewloop`: configured reviewer protocol and bounded rerun policy.
- `systematic-debugging`, `diagnosis`, `investigation`: optional problem-solving
  guidance.
- `test-driven-development`, `verification-before-completion`: evidence
  guidance subject to repository confirmation rules.
- `receiving-code-review`: handling findings without letting reviewers repair
  code directly.

Execution mode and provider/model selection are not skill personas. Configure
`.specdev/agents.yaml`.
Task-specific durable guidance belongs in `.specdev/guides/`.
