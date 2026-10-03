# SpecDev skills

Core skills give compact reference guidance. Static RippleGraph packages and
semantic CLI commands own lifecycle transitions and durable state.

Request routing happens outside the graph. Direct questions, inspection, and
small non-behavioral documentation writes create no state, receipt, or automatic
commit. The user must explicitly select Roadmap or Adhoc work.

Roadmap is stateless. After exact user approval, it can edit
`roadmap/forecast.md`, `roadmap/todo.md`, and bounded design Markdown files.
Forecast treats designs as the target. It lists only absent or incomplete code
in dependency order. Each numbered section has fewer than 200 words and cites
the design notes it is based on. Todo records user-selected future work outside
architecture. It orders items by dependency, then user priority. It uses the same
numbered sections and word limit, but omits provenance.
Neither list grants implementation authority. Code can contain more than the
designs require. Those extra features create no forecast items or automatic
design updates.

Write design drafts as `*_draft.md` and report only their paths. Promote them
to final `.md` files only after user approval. Commit them automatically when
published. Except for `source_code_folder_structure.md`, design prose starts
with general descriptions and then gives specific details. No fixed Markdown
format is required. Notes other than `core_concepts.md` and
`source_code_folder_structure.md` end with their targeted source files and the
maximum total line count for each completed file. They may include a small folder
tree or pseudocode when helpful. Neither illustration is required.

When the user explicitly requests a separate public-function design note,
Roadmap may suggest typed signatures that match the implementation.
Classes use CapCase. Instance and returned-value names use `snake_case`.
Signatures show return types and values. This is optional guidance, not a
required file, scaffold, format, or validation rule.

Roadmap has no active lifecycle. Selecting another lane immediately supersedes
it without an exit command or state transition. Adhoc creates one receipt and
one final commit, but no RippleGraph run.

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
