# Direct Lane

Parent design: `./workflow_lanes.md`

Direct is immediate work that does not need governed product mutation or a durable
workflow identity. It covers answers, explanations, status, read-only inspection,
and small user-requested documentation whose content does not change product,
runtime, workflow, or public-contract behavior.

The user's request is the complete authority boundary. Direct may inspect relevant
files and may write only the explicitly requested non-behavioral artifact. It does
not create a graph, receipt, snapshot, approval record, automatic review, or delivery
commit.

Classification follows semantic effect. A one-line schema change, managed template
edit, behavioral configuration, public compatibility promise, or Roadmap design
revision is not Direct merely because it is text or small. Product mutation requires
Adhoc, Assignment, or Mission; Roadmap and knowledge changes use their owning
collaboration or curation boundary.

For a direct documentation write, the agent reads destination instructions and only
the facts needed, writes once, and verifies narrowly. It does not load broad project
context unless the artifact needs it. An explicitly requested handoff note in
another repository remains auxiliary only when it does not change that repository's
product or workflow state.

Direct may coexist with all lanes because it owns no scheduler. It must preserve
active identities, artifacts, dirty-path ownership, and mutation boundaries. A
read-only discovery may motivate a governed action, but it cannot silently start one
or carry authority into it.

## Source Targets

- `templates/.specdev/_main.md` — maximum 240 lines — canonical Direct classification guidance.
- `templates/.specdev/_guides/workflow.md` — maximum 300 lines — installed Direct boundary examples.
- `src/commands/dispatch.js` — maximum 240 lines — preservation of active governed boundaries.
