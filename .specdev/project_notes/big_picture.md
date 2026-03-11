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
- Assignment resolution: `resolveAssignmentPath(flags)` finds the latest or specified assignment
- Assignment IDs: `00001_feature_auth` — sequential number + type + name
- Types: `feature | bugfix | refactor | familiarization` — parsed by `parseAssignmentId()`
- Tool skills: SKILL.md (agent protocol) + scripts/ (deterministic mechanics) + optional wrappers per agent platform
- `OFFICIAL_TOOL_SKILLS` in `src/utils/update.js` controls which tool skills are auto-managed
- **Knowledge system:** After assignments complete, `specdev distill` aggregates capture diffs and heuristics into JSON; agent writes to `knowledge/` branches (codestyle, architecture, domain, workflow). `specdev distill done` validates big_picture word count and feature_descriptions entry, then marks processed via `knowledge/.processed_captures.json`.
- **Reviewloop:** `src/commands/reviewloop.js` orchestrates external reviewer CLIs (codex, cursor, etc.) in automated review rounds with feedback written to `review/{phase}-feedback.md`. Reviewer configs are JSON files in `skills/core/reviewloop/reviewers/`.

## Conventions and constraints

- **Testing:** Plain Node.js test files (no test framework). Each test file uses a simple `assert(condition, msg)` pattern with pass/fail counters. Tests create isolated directories, run CLI commands via `spawnSync`, and clean up.
- **No TypeScript, no transpilation** — pure ESM JavaScript
- **Skills have YAML frontmatter** with `name`, `type`, `phase`, `triggers` fields
- **Phase gates are hard** — `specdev approve <phase>` is required to proceed; agents cannot skip
- **Checkpoint validation is structural** — checks required files/headers exist, not content quality
- **Platform adapters are generated** — CLAUDE.md, AGENTS.md, .cursor/rules are created by init, not hand-written
- **Commit style:** conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
