# Distill Commands Design

## Goal

Replace the interactive `ponder` commands with agent-driven `distill` commands that output JSON for a coding agent to process, enabling project-level knowledge aggregation from per-assignment captures.

## Context

- Per-assignment knowledge capture (phase 4) produces `capture/project-notes-diff.md` and `capture/workflow-diff.md`
- These diffs accumulate but nothing aggregates them into project-level knowledge without the old interactive `ponder` commands
- `ponder` used readline prompts that don't work inside a coding agent session
- The new `distill` commands output JSON so the agent can present findings to the user and write accepted observations

## Commands

### specdev distill project

```
specdev distill project [--assignment=<name>] [--target=<path>]
```

Scans assignments, generates project knowledge suggestions (heuristics + capture diffs), outputs JSON. Agent parses output, presents to user, writes to `knowledge/<branch>/`.

### specdev distill workflow

```
specdev distill workflow [--assignment=<name>] [--target=<path>]
```

Scans assignments, generates workflow suggestions (heuristics + capture diffs), outputs JSON. Agent parses output, presents to user, writes to `knowledge/_workflow_feedback/`.

### specdev distill mark-processed

```
specdev distill mark-processed <project|workflow> <assignment1,assignment2,...>
```

Marks assignments as processed so they aren't re-surfaced on the next distill run.

## JSON Output Schema

### distill project

```json
{
  "status": "ok",
  "scanned": 5,
  "unprocessed": 2,
  "existing_knowledge": {
    "codestyle": ["2026-01-15_observations.md"],
    "architecture": [],
    "domain": [],
    "workflow": ["2026-02-10_observations.md"]
  },
  "suggestions": [
    {
      "branch": "architecture",
      "title": "Capture architectural decisions",
      "body": "3 assignments contain decisions...",
      "source": "heuristic",
      "assignments": ["00001_feature_auth"]
    },
    {
      "branch": "architecture",
      "title": "Capture diff from 00003_feature_search",
      "body": "Full diff content here...",
      "source": "capture-diff",
      "assignments": ["00003_feature_search"]
    }
  ],
  "knowledge_paths": {
    "codestyle": ".specdev/knowledge/codestyle/",
    "architecture": ".specdev/knowledge/architecture/",
    "domain": ".specdev/knowledge/domain/",
    "workflow": ".specdev/knowledge/workflow/"
  }
}
```

### distill workflow

Same shape but suggestions have no `branch` field (all go to `_workflow_feedback/`), and `knowledge_paths` points to `_workflow_feedback/`.

## Implementation Scope

### New files

- `src/commands/distill-project.js` — scan + heuristics + JSON output
- `src/commands/distill-workflow.js` — scan + heuristics + JSON output
- `src/commands/distill-mark.js` — mark assignments as processed
- `tests/test-distill-project.js`
- `tests/test-distill-workflow.js`
- `tests/test-distill-mark.js`

### Modified files

- `src/commands/dispatch.js` — add `distill` routing, remove `ponder` routing
- `src/commands/help.js` — replace ponder entries with distill entries
- `package.json` — replace ponder test scripts with distill test scripts

### Deleted files

- `src/commands/ponder-project.js`
- `src/commands/ponder-workflow.js`

### Reused as-is

- `src/utils/scan.js` — `scanAssignments`, `readProcessedCaptures`, `markCapturesProcessed`, `readKnowledgeBranch`
- Heuristic logic ported from ponder commands (same algorithms, JSON output instead of interactive prompts)

### Not changed

- `knowledge-capture` SKILL.md — stays as per-assignment capture skill
- `src/utils/prompt.js` — no longer imported by distill commands

## Design Decisions

- **JSON-only output** — no `--json` flag needed, always JSON. These commands exist for agent consumption.
- **Track processed assignments** — reuses existing `markCapturesProcessed` / `readProcessedCaptures` from scan.js to prevent duplicate suggestions.
- **Keep heuristics** — rule-based suggestion generators (pattern detection across assignments) ported from ponder, plus raw capture diffs.
- **Separate mark-processed command** — clean CLI contract; agent calls `distill mark-processed` after writing knowledge files rather than writing to internal tracking files directly.
- **Two separate commands** — `distill project` and `distill workflow` as separate files, matching the existing command pattern.
