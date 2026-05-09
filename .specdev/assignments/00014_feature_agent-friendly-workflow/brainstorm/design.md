# Design: Agent-Friendly Workflow

## Overview

Coding agents using specdev in consumer repos struggle with three things: discovering available commands, knowing what knowledge exists, and parsing human-formatted output. This design adds a `specdev context --json` command as a single entry point, a `knowledge list` subcommand, universal `--json` support across all commands, and improved session hooks.

## Goals

- All workflow and utility commands accept `--json` and return structured output (except `start` which is interactive, and `--version` which agents get via `context --json`)
- Single `specdev context --json` call gives agents everything they need on cold start
- Agents can discover accumulated knowledge without filesystem scanning
- Session hook injects phase-relevant commands and knowledge availability

## Non-Goals

- Changing the `.specdev/` folder structure or guide/skill markdown content
- Adding AI-specific features (embeddings, semantic search beyond existing FTS)
- Changing the 4-phase workflow itself

## Design

### Tier 1: New Commands

#### `specdev context --json`

Single command that dumps everything an agent needs on cold start. Replaces agents having to call `status --json` + `skills --json` + filesystem scanning.

```json
{
  "command": "context",
  "version": 1,
  "cli_version": "0.0.4",
  "release_date": "2026-05-08",
  "assignment": {
    "id": "00014",
    "name": "00014_feature_agent-friendly-workflow",
    "phase": "brainstorm",
    "state": "brainstorm_in_progress",
    "path": ".specdev/assignments/00014_feature_agent-friendly-workflow"
  },
  "commands": [
    { "name": "assignment", "usage": "assignment \"<desc>\"", "description": "Reserve next assignment ID" },
    { "name": "continue", "usage": "continue", "description": "Detect current state, suggest next action" }
  ],
  "knowledge": {
    "files": [
      { "path": "knowledge/architecture/flat-skill-view-scope.md", "branch": "architecture", "title": "Flat Skill View Scope" },
      { "path": "knowledge/workflow_feedback/codex-sandbox-test-limitations.md", "branch": "workflow_feedback", "title": "Codex Sandbox Test Limitations" }
    ],
    "index_exists": true,
    "indexed_document_count": 42
  },
  "project_notes": [
    "project_notes/big_picture.md",
    "project_notes/feature_descriptions.md",
    "project_notes/assignment_progress.md",
    "project_notes/working_memory.md"
  ],
  "skills": {
    "core": ["brainstorming", "breakdown", "implementing", "knowledge-capture", "diagnosis", "investigation"],
    "tools": ["reviewloop-codex", "verify-tests"]
  }
}
```

**Implementation:** New `src/commands/context.js`. Composes existing utilities:
- `resolveCurrentAssignment()` + `detectAssignmentState()` for assignment info
- `COMMANDS` from `src/utils/commands.js` for command list
- Filesystem scan of `knowledge/` and `project_notes/` for file listings
- `skills --json` logic for skill inventory
- Check for `cache/knowledge.sqlite` existence for index status

**Human output (no --json flag):** Compact summary with sections, not full JSON. Agents should always use `--json`.

#### `specdev knowledge list --json`

Inventory of all knowledge files without needing a search query.

```json
{
  "command": "knowledge list",
  "version": 1,
  "files": [
    { "path": "knowledge/architecture/flat-skill-view-scope.md", "branch": "architecture", "title": "Flat Skill View Scope" },
    { "path": "knowledge/architecture/sqlite-knowledge-retrieval.md", "branch": "architecture", "title": "SQLite Knowledge Retrieval" }
  ],
  "branches": {
    "architecture": 2,
    "codestyle": 0,
    "domain": 0,
    "workflow": 0,
    "workflow_feedback": 3
  }
}
```

**Implementation:** Add `list` subcommand to existing `src/commands/knowledge.js`. Reuse `collectKnowledgeDocuments()` from `src/utils/knowledge.js` for file discovery. Extract title from first H1 heading in each file.

### Tier 2: Add `--json` to High-Use Commands

These commands currently output prose only. Add structured JSON following the existing envelope pattern `{ command, version, status, ... }`:

| Command | JSON payload |
|---------|-------------|
| `approve` | `{ phase, assignment, approved: true }` |
| `focus` | `{ assignment_id, assignment_name, path }` |
| `implement` | `{ assignment, plan_path, tasks: [...], execution_mode }` |
| `revise` | `{ assignment, revision_recorded: true, phase: "brainstorm" }` |
| `help` | `{ commands: [{ name, usage, description, flags }] }` |

### Tier 3: Add `--json` to Remaining Commands

Same envelope pattern for lower-frequency commands:

| Command | JSON payload |
|---------|-------------|
| `skills install` | `{ skill, installed: true, path }` |
| `skills remove` | `{ skill, removed: true }` |
| `skills sync` | `{ synced: [...], created: [...], removed: [...] }` |
| `update` | `{ cli_version, release_date, updated: [...], preserved: [...] }` |
| `migrate` | `{ plan_path, moves: [...] }` |
| `migrate legacy-assignments` | `{ migrated: [...], skipped: [...] }` |
| `review` | `{ phase, review_session_started: true }` |

### Tier 4: Session Hook Improvements

Replace bash state detection in `hooks/session-start.sh` with `specdev context --json` consumption.

**Current hook:** Runs `specdev continue --json`, parses assignment name and phase, injects 3-4 lines of phase rules plus tool skills.

**Improved hook:** Runs `specdev context --json` and injects:
1. Current assignment + phase (already does this)
2. **Phase-relevant commands** — e.g., in implementation phase: "Available: `specdev checkpoint implementation`, `specdev reviewloop implementation`"
3. **Knowledge availability** — "N knowledge files indexed. Run `specdev knowledge search \"<query>\"` for prior decisions."
4. **Recent history** — Last completed assignment name (helps agents avoid re-proposing solved work)

## Key Decisions

1. **`context` is read-only** — It never modifies state. Safe to call at any point.
2. **JSON envelope consistency** — All commands follow `{ command, version, ... }` pattern already established by `continue`, `checkpoint`, `assignment`.
3. **Human output is secondary** — For new commands (`context`, `knowledge list`), human output is a compact summary. Agents should always use `--json`.
4. **No breaking changes** — Existing command behavior unchanged. `--json` is purely additive.
5. **`context` composes, doesn't duplicate** — It calls into existing utilities rather than reimplementing state detection.

## Success Criteria

1. Every specdev command accepts `--json` and returns structured output
2. `specdev context --json` gives an agent everything it needs to start working in one call
3. `specdev knowledge list --json` shows all accumulated knowledge without a search query
4. Session hook injects phase-relevant commands and knowledge availability
5. All existing tests continue to pass
6. New commands have test coverage

## Testing Approach

- Unit tests for `context --json` output shape and field completeness
- Unit tests for `knowledge list --json` output shape
- For each command getting `--json` added: test that `--json` flag produces valid JSON with expected fields
- Integration test: `context --json` in a fresh `specdev init` project vs. one with assignments and knowledge
- Hook test: verify improved hook output includes commands and knowledge info
