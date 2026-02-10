# Decisions Log

## Decision 1: Templates-only approach (no runtime)
- **Context:** Could build the CLI as an agent orchestrator/runtime, or keep it as a scaffolder that ships templates
- **Decision:** Templates-only — agents figure out orchestration using the guides
- **Rationale:** Aligns with Claude Code's agent teams concept. Simpler, less coupling, works with any agent tool.

## Decision 2: Global knowledge does not ship to users
- **Context:** Originally planned `_global/` directory in user projects. Discussed whether agents in user projects need to read global workflow knowledge directly.
- **Decision:** Global knowledge lives only in this repo (`learnings/`). Users get refined guides, not raw global knowledge.
- **Rationale:** Agents should read the guides (refined output), not raw aggregated feedback. Keeps user projects clean. The `_workflow_feedback/` directory in user projects is a collection point for the maintainer, not a read target for agents.

## Decision 3: Three-tier temporal knowledge model
- **Context:** Single flat learnings file would become unwieldy. Needed structure.
- **Decision:** Working (task-scoped scratch) → Short-term (assignment context/decisions/messages) → Long-term (knowledge vault tree)
- **Rationale:** Maps naturally to scope boundaries. Limits what each agent needs to load. Distillation steps flow upward at natural workflow transitions.

## Decision 4: `_workflow_feedback/` as collection point in user projects
- **Context:** Need a place in user projects for agents to write workflow-level observations so maintainer can collect them later.
- **Decision:** `knowledge/_workflow_feedback/` directory, preserved by `specdev update`
- **Rationale:** Sits inside knowledge/ but with `_` prefix signaling it's not local project knowledge. Maintainer collects from here across projects.

## Decision 5: Node built-in readline for ponder prompts
- **Context:** Options were `inquirer` (heavy), `prompts` (lighter), or Node's built-in `readline`
- **Decision:** Built-in `readline`
- **Rationale:** No new dependencies. Keeps the package minimal. Sufficient for accept/edit/reject/custom flow.

## Decision 6: Rule-based ponder suggestions for v1
- **Context:** LLM-generated suggestions would be more insightful but require an API key
- **Decision:** Rule-based scanning (detect skipped phases, missing context, inconsistent decomposition)
- **Rationale:** Works offline, no API key needed. Can add `--smart` LLM flag later.

## Decision 7: `specdev update` ensures new directories exist
- **Context:** Users upgrading from old structure won't have `knowledge/`. `update` only copied system files.
- **Decision:** Added "ensure" logic — create new project directories if missing, never overwrite existing.
- **Rationale:** Seamless migration path. No manual steps needed for upgrading users.
