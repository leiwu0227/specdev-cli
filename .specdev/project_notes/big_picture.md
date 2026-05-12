# Project Big Picture

## What does this project do?

specdev-cli is a CLI tool that enforces a spec-driven development workflow for AI coding agents (Claude Code, Codex, Cursor, etc.). It provides structured phases — brainstorm, breakdown, implementation, review — with hard gates between them. Agents must produce artifacts (proposal, design, plan, code) and get approval at each gate before proceeding.

The tool installs a `.specdev/` directory into a project with skills (agent protocols), templates, guides, and scripts. Platform adapters (CLAUDE.md, AGENTS.md, .cursor/rules) wire the workflow into each agent's native skill system.

## Who are the users?

Developers who use AI coding agents and want structured, repeatable workflows. The CLI is run by the developer; the `.specdev/` artifacts are consumed by the AI agent during its session.

## Tech stack and key dependencies

- **Runtime:** Node.js (ESM modules, `"type": "module"`)
- **Dependencies:** `fs-extra` (file operations), `yaml` (nested agent spec parsing), `ajv` (JSON Schema validation)
- **Shell scripts:** Bash hook for SessionStart context loading
- **Package:** `@specdev/cli` v0.0.4, published via npm
- **Entry point:** `bin/specdev.js` → `src/utils/cli.js` → `src/commands/dispatch.js`
- **No build step** — runs directly from source

## Architecture

```
bin/specdev.js          CLI entry point
src/commands/           Command handlers (one file per command)
src/commands/dispatch.js  Routes command name → handler
src/utils/              Shared utilities (assignment resolution, scanning, output)
templates/.specdev/     Template source — copied into projects on init/update
  skills/core/          Core phase skills (brainstorming, breakdown, implementing, etc.)
  skills/tools/         Tool skills — optional, installable
  _templates/           Assignment and design templates
  _guides/              Workflow and migration guides
hooks/                  Platform hooks (SessionStart for Claude Code)
```

**Key patterns:**
- Commands follow a consistent signature: `export async function fooCommand(positionalArgs, flags)`
- **`.current` pointer:** `.specdev/.current` file tracks the active assignment. Set by `specdev focus <id>` or auto-set on `specdev assignment --type --slug`. All commands read `.current` — no heuristic auto-detection.
- **Two assignment creation paths:** Plain `specdev assignment "desc"` reserves an ID for human folder creation. `specdev assignment "desc" --type=<type> --slug=<slug>` creates folders and sets `.current` automatically (used by agents).
- **Discussions:** Lightweight pre-assignment brainstorming under `.specdev/discussions/D####_slug/`. Created via `specdev discussion "desc"`. Require explicit `--discussion` flag on commands. Promotable to assignments via `specdev assignment "desc" --discussion=D0001 --type --slug`.
- Assignment IDs: `00001_feature_auth` — sequential number + type + name
- Types: `feature | bugfix | refactor | familiarization` — parsed by `parseAssignmentId()`
- Tool skills: SKILL.md (agent protocol) + scripts/ (deterministic mechanics) + optional wrappers per agent platform
- **Skill inspection:** `specdev skills` lists core/tool skills for humans; `specdev skills --json` emits a machine-readable skill inventory; `specdev skills view <name> [relative-path]` prints a single `SKILL.md` or support file with traversal protection. This supports progressive skill loading by agents.
- **Knowledge system:** Optional phase-end knowledge capture (`skills/core/knowledge-capture/SKILL.md`) writes small, durable notes into `knowledge/` branches (codestyle, architecture, domain, workflow, workflow_feedback) when reusable knowledge is learned. Capture is never blocking. Follow prune-and-replace discipline.
- **Workflow feedback format:** `templates/.specdev/_templates/workflow_feedback_note.md` gives agents a structured Markdown format for durable SpecDev workflow feedback. Knowledge Capture distinguishes project-specific process notes in `knowledge/workflow/` from SpecDev product/workflow issues in `knowledge/workflow_feedback/`.
- **Working memory:** `specdev memory refresh` generates `.specdev/project_notes/working_memory.md`, a bounded markdown summary for agents. It draws from project context, current workflow state, recent completed assignments, and durable knowledge notes while staying within a fixed word limit.
- **Knowledge retrieval:** `specdev knowledge index` builds a generated SQLite FTS cache at `.specdev/cache/knowledge.sqlite` from SpecDev markdown artifacts, and `specdev knowledge search <keywords>` returns ranked document matches for agents. Markdown remains the source of truth; the cache is disposable and ignored by git.
- **Workflow contract:** `src/utils/workflow-contract.js` centralizes structured workflow facts such as assignment types, command phase lists, required brainstorm sections, core artifact paths, and gate/status field names. Commands and generated command-skill prose read from the contract, while focused drift tests keep templates and guides aligned with those facts.
- **Workflow runtime overlay:** `templates/.specdev/workflow.yaml` declares the installed phase/step/hook/gate contract, and `specdev next --json` computes the canonical next action from assignment state plus the validated manifest. The runtime preserves the existing assignment folder layout, derives action guides/commands/evidence from manifest steps, emits structured review choices at gate decision points, and surfaces advisory hook outcomes without bypassing approvals.
- **Workflow agents:** Agents are a third workflow primitive alongside skills and scripts: path-based, contract-bound reasoning subroutines executed through external CLIs. Agent specs live under `templates/.specdev/agents/<name>/` and install to `.specdev/agents/<name>/`. `src/utils/agent-runner.js` loads Markdown Agent Specs, validates metadata and final JSON output with `ajv`, supports stdin/argv prompt transports, process-group timeout cleanup, capped stdout, stream-json sidecars, retries, and required markdown section validation. The first shipped agent is the researcher, invoked by `specdev research`, with debug validation via `specdev agents inspect <path>`.
- **Reviewloop:** `src/commands/reviewloop.js` orchestrates external reviewer CLIs (codex, cursor, etc.) in automated review rounds with feedback written to `review/{phase}-feedback.md`. Reviewer configs are JSON files in `skills/core/reviewloop/reviewers/` (codex, cursor, cursor-gemini, claude). `review-focus.json` defines round-specific focus areas (architecture → efficiency → domain → general) passed via `SPECDEV_FOCUS` env var. Supports multi-reviewer chains (`--reviewer=a,b,c`) with independent round counters and per-reviewer feedback files. Supports discussion reviewloop via `SPECDEV_DISCUSSION` env var passed to reviewer subprocesses. `reviewloop --preflight --reviewer=<name> [--json]` checks reviewer config, command, binary availability, timeout normalization, and review directory writability without launching the reviewer; normal reviewer execution also blocks on preflight errors before spawning external CLIs. Long-running reviewer subprocesses are owned by `src/utils/reviewer-runner.js`, which provides heartbeat output, process-group timeout termination, capped stdout capture, and reviewer log metadata. Claude uses stream-json mode with rendered progress logs plus raw JSONL sidecars, while plain-text reviewers can recover strict `## Round N` stdout feedback when the expected round is missing.
- **Reviewloop autocontinue:** `specdev reviewloop <phase> --reviewer=<name> --autocontinue` emits an explicit continuation contract after an approved assignment review. Brainstorm approval tells agents to continue to breakdown/implementation and reuse the same reviewer for implementation review; implementation approval tells agents to continue to capture. Discussions remain standalone and do not advertise autocontinue.
- **Workflow status:** `specdev status [--json]` reuses `continue` state detection to expose the active assignment state, gates, artifact presence, blockers, progress, review diagnostics, and next action for humans or automation.
- **Migration:** `specdev migrate` is a non-destructive guided entrypoint for semantic `.specdev/` layout migration. The old deterministic root assignment-file mover is explicit: `specdev migrate legacy-assignments`.

## Conventions and constraints

- **Testing:** Plain Node.js test files (no test framework). The maintained suite is a compact command-level smoke/regression suite, not one file per source module. It focuses on user-blocking workflows such as init/update, assignment state, gates, reviewloop, workflow agents, and knowledge capture. Tests create isolated directories, run CLI commands via `spawnSync`, and clean up.
- **No TypeScript, no transpilation** — pure ESM JavaScript
- **Skills have YAML frontmatter** with `name`, `type`, `phase`, `triggers` fields
- **Phase gates are hard** — `specdev approve <phase>` is required to proceed; agents cannot skip
- **Checkpoint validation is structural** — checks required files/headers exist, not content quality
- **Platform adapters are generated** — CLAUDE.md, AGENTS.md, .cursor/rules are created by init, not hand-written
- **Commit style:** conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
