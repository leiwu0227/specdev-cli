# Project Big Picture

## What does this project do?

specdev-cli is a CLI tool that enforces a spec-driven development workflow for AI coding agents (Claude Code, Codex, Cursor, etc.). It provides structured phases — brainstorm, breakdown, implementation, review — with hard gates between them. Agents must produce artifacts (proposal, design, plan, code) and get approval at each gate before proceeding.

The tool installs a `.specdev/` directory into a project with skills (agent protocols), templates, guides, and scripts. Platform adapters (CLAUDE.md, AGENTS.md, .cursor/rules) wire the workflow into each agent's native skill system.

## Who are the users?

Developers who use AI coding agents and want structured, repeatable workflows. The CLI is run by the developer; the `.specdev/` artifacts are consumed by the AI agent during its session.

## Tech stack and key dependencies

- **Runtime:** Node.js (ESM modules, `"type": "module"`)
- **Dependencies:** `fs-extra` (file operations), `js-yaml` (YAML frontmatter parsing)
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
- `OFFICIAL_TOOL_SKILLS` in `src/utils/update.js` controls which tool skills are auto-managed
- **Skill inspection:** `specdev skills` lists core/tool skills for humans; `specdev skills --json` emits a machine-readable skill inventory; `specdev skills view <name> [relative-path]` prints a single `SKILL.md` or support file with traversal protection. This supports progressive skill loading by agents.
- **Knowledge system:** After assignments complete, `specdev distill` aggregates capture diffs and heuristics into JSON; agent writes to `knowledge/` branches (codestyle, architecture, domain, workflow). `specdev distill done` validates big_picture word count and feature_descriptions entry, then marks processed via `knowledge/.processed_captures.json` and returns a `memory_hint`.
- **Workflow feedback format:** `templates/.specdev/_templates/workflow_feedback_note.md` gives agents a structured Markdown format for durable SpecDev workflow feedback. Knowledge Capture distinguishes project-specific process notes in `knowledge/workflow/` from SpecDev product/workflow issues in `knowledge/workflow_feedback/`.
- **Working memory:** `specdev memory refresh` generates `.specdev/project_notes/working_memory.md`, a bounded markdown summary for agents. It draws from project context, current workflow state, recent completed assignments, and durable knowledge notes while staying within a fixed word limit.
- **Knowledge retrieval:** `specdev knowledge index` builds a generated SQLite FTS cache at `.specdev/cache/knowledge.sqlite` from SpecDev markdown artifacts, and `specdev knowledge search <query>` returns ranked document matches for agents. Markdown remains the source of truth; the cache is disposable and ignored by git.
- **Reviewloop:** `src/commands/reviewloop.js` orchestrates external reviewer CLIs (codex, cursor, etc.) in automated review rounds with feedback written to `review/{phase}-feedback.md`. Reviewer configs are JSON files in `skills/core/reviewloop/reviewers/` (codex, cursor, cursor-gemini, claude). `review-focus.json` defines round-specific focus areas (architecture → efficiency → domain → general) passed via `SPECDEV_FOCUS` env var. Supports multi-reviewer chains (`--reviewer=a,b,c`) with independent round counters and per-reviewer feedback files. Supports discussion reviewloop via `SPECDEV_DISCUSSION` env var passed to reviewer subprocesses. `reviewloop --preflight --reviewer=<name> [--json]` checks reviewer config, command, binary availability, timeout normalization, and review directory writability without launching the reviewer; normal reviewer execution also blocks on preflight errors before spawning external CLIs. Long-running reviewer subprocesses are owned by `src/utils/reviewer-runner.js`, which provides heartbeat output, process-group timeout termination, capped stdout capture, and reviewer log metadata. Claude uses stream-json mode with rendered progress logs plus raw JSONL sidecars, while plain-text reviewers can recover strict `## Round N` stdout feedback when the expected round is missing.
- **Workflow status:** `specdev status [--json]` reuses `continue` state detection to expose the active assignment state, gates, artifact presence, blockers, progress, review diagnostics, and next action for humans or automation.
- **Migration:** `specdev migrate` is a non-destructive guided entrypoint for semantic `.specdev/` layout migration. The old deterministic root assignment-file mover is explicit: `specdev migrate legacy-assignments`.

## Conventions and constraints

- **Testing:** Plain Node.js test files (no test framework). Each test file uses a simple `assert(condition, msg)` pattern with pass/fail counters. Tests create isolated directories, run CLI commands via `spawnSync`, and clean up.
- **No TypeScript, no transpilation** — pure ESM JavaScript
- **Skills have YAML frontmatter** with `name`, `type`, `phase`, `triggers` fields
- **Phase gates are hard** — `specdev approve <phase>` is required to proceed; agents cannot skip
- **Checkpoint validation is structural** — checks required files/headers exist, not content quality
- **Platform adapters are generated** — CLAUDE.md, AGENTS.md, .cursor/rules are created by init, not hand-written
- **Commit style:** conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
