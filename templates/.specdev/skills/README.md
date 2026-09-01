# SpecDev skills

Core skills are compact reference guidance. Static RippleGraph packages and
semantic CLI commands own lifecycle transitions and durable state.

Request routing is deliberately outside the graph: Direct questions,
inspection, and small non-behavioral documentation writes create no state,
receipt, or automatic commit; explicitly user-selected Roadmap collaboration is
stateless and restricted to `roadmap/forecast.md` plus bounded design Markdown
files after exact user approval. Forecast gaps are derived by quickly comparing
the designs with current code, ordered by dependency, and limited to fewer than
200 words per Markdown section. Explicitly user-selected Adhoc work creates one
receipt and final commit but no RippleGraph run.

- `brainstorming`: interactive contract or Discussion authoring.
- `reviewloop`: configured reviewer protocol and bounded rerun policy.
- `systematic-debugging`, `diagnosis`, `investigation`: optional problem-solving
  guidance.
- `test-driven-development`, `verification-before-completion`: evidence
  guidance subject to repository confirmation rules.
- `receiving-code-review`: handling findings without letting reviewers repair
  code directly.

Provider/model selection is not a skill persona. Configure `.specdev/agents.yaml`.
Task-specific durable guidance belongs in `.specdev/guides/`.
