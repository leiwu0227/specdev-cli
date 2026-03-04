# Investigation: Distill Refactoring

## Summary

The `specdev distill` commands exist but are disconnected from the workflow. Refactor distill into a two-step flow (distill + distill done) integrated into knowledge-capture as a hard requirement. Allow direct big_picture.md updates with a word limit enforced by `distill done`. Add a fallback nudge in `specdev continue`.

## Overview

The distill system has three layers:
1. **Per-assignment capture** — Phase 4 produces `capture/project-notes-diff.md` and `capture/workflow-diff.md`
2. **Aggregation** — `specdev distill` scans captures, applies heuristics, outputs JSON for the agent
3. **Tracking** — `specdev distill done` validates and marks processed

Layer 1 works. Layers 2-3 need refactoring — currently split across three commands (`distill project`, `distill workflow`, `distill mark-processed`) that nothing in the workflow triggers.

## Design

### Combined `specdev distill` command

Merge `distill project` and `distill workflow` into one command:

```
specdev distill --assignment=<name>
```

JSON output (compact — no file contents for knowledge/ files):

```json
{
  "status": "ok",
  "assignment": "00001_feature_auth",
  "capture": {
    "project_notes_diff": "content of capture/project-notes-diff.md",
    "workflow_diff": "content of capture/workflow-diff.md"
  },
  "knowledge_files": {
    "codestyle": ["naming-conventions.md"],
    "architecture": [],
    "domain": [],
    "workflow": [],
    "_workflow_feedback": []
  },
  "big_picture_path": ".specdev/project_notes/big_picture.md",
  "big_picture_word_count": 1450,
  "big_picture_word_limit": 2000,
  "heuristics": [
    {
      "title": "...",
      "body": "...",
      "source": "heuristic",
      "assignments": ["..."]
    }
  ]
}
```

Key design decisions:
- Capture diffs included inline (small, always relevant)
- Knowledge files listed by filename only (agent reads on demand to avoid context bloat)
- big_picture word count + limit included so agent knows the budget
- Heuristics kept (cross-assignment patterns, low-noise)
- Without `--assignment`: not needed (continue nudge uses scan.js directly)

### `specdev distill done <name>`

Validation gate + bookkeeping:

1. Check `big_picture.md` word count ≤ 2000 → fail = agent trims, retries
2. Check assignment name appears in `feature_descriptions.md` → fail = agent adds entry, retries
3. On success: mark assignment as processed in `knowledge/.processed_captures.json` (both project and workflow types)

### Knowledge-capture SKILL.md changes

Updated workflow within knowledge-capture:

**Step 1: Capture diffs** (unchanged)
- Write `capture/project-notes-diff.md`
- Write `capture/workflow-diff.md`

**Step 2: Update catalogs** (unchanged)
- Add entry to `feature_descriptions.md`
- Mark assignment DONE in `assignment_progress.md`

**Step 3: Update big_picture.md** (changed — was "diffs only, user decides")
- Read big_picture.md, update with new info from this assignment
- Keep it lean — under 2000 words
- Add new systems/components, revise outdated descriptions, remove stale info
- No implementation details, architecture-level facts only

**Step 4: Run distill** (new — hard requirement)
- Run `specdev distill --assignment=<name>`
- Read JSON output
- Write synthesized observations to `knowledge/` branches as appropriate
- Write workflow observations to `knowledge/_workflow_feedback/` as appropriate
- If no new observations, that's OK — not every assignment produces knowledge

**Step 5: Finalize** (new — hard requirement)
- Run `specdev distill done <name>`
- If validation fails, fix and retry
- On success, assignment is complete

### `specdev continue` nudge

Non-blocking hint on every `specdev continue` call:
- Check for unprocessed assignments using `readProcessedCaptures` from scan.js (no CLI shelling)
- If count > 0, add to payload:

```json
{
  "distill_pending": {
    "count": 2,
    "assignments": ["00001_feature_auth", "00002_refactor_api"]
  }
}
```

Text output:
```
Distill Pending:
  2 assignment(s) have unprocessed captures
  Run: specdev distill --assignment=<name>
```

Shows regardless of selected assignment state — it's about accumulated debt.

## Files to modify

### New/rewritten
- `src/commands/distill.js` — Combined distill command (replaces distill-project.js + distill-workflow.js)
- `src/commands/distill-done.js` — Validation gate + mark-processed (replaces distill-mark.js)

### Deleted
- `src/commands/distill-project.js` — merged into distill.js
- `src/commands/distill-workflow.js` — merged into distill.js
- `src/commands/distill-mark.js` — replaced by distill-done.js

### Modified
- `src/commands/dispatch.js` — Update distill routing (distill + distill done)
- `src/commands/help.js` — Update distill entries
- `src/commands/continue.js` — Add distill-pending nudge
- `templates/.specdev/skills/core/knowledge-capture/SKILL.md` — Add Steps 3-5
- `.specdev/skills/core/knowledge-capture/SKILL.md` — Same (local copy)
- Tests: Rewrite test-distill.js for new command structure

### Unchanged
- `src/utils/scan.js` — Already has all needed utilities
- `src/utils/state.js` — Distill is not a state (advisory nudge only)

## Backward Compatibility

Old commands are removed outright — no aliases or deprecation warnings:
- `distill project` → removed (use `specdev distill`)
- `distill workflow` → removed (use `specdev distill`)
- `distill mark-processed` → removed (use `specdev distill done`)

This is a clean breaking change. Rationale: the old commands were never called by the workflow or any skill file. No external scripts depend on them — they were only used in tests and by manual invocation. Tests are rewritten as part of this work.

## Error Handling

### `specdev distill --assignment=<name>`
- **Assignment not found:** exit 1, JSON `{ "status": "error", "error": "Assignment not found: <name>" }`
- **No capture diffs:** exit 0, JSON with `"status": "no_captures"`, empty capture fields. Agent can still run `distill done` (captures are optional for familiarization assignments).
- **Corrupt `.processed_captures.json`:** treat as empty (existing behavior from scan.js), don't crash.
- **Missing `--assignment`:** exit 1, print usage.

### `specdev distill done <name>`
- **big_picture.md over word limit:** exit 1, message: `"big_picture.md is N words (limit: 2000). Trim and retry."`
- **Assignment not in feature_descriptions.md:** exit 1, message: `"Assignment <name> not found in feature_descriptions.md. Add an entry and retry."`
- **Assignment not found:** exit 1, error message.
- **Already processed:** exit 0, no-op with message: `"Already processed."`

## Continue Nudge Limits

The `distill_pending` payload caps at 5 assignment names. If more than 5 are pending:
- `count` shows the true total
- `assignments` shows the 5 oldest (by directory name sort order)
- Text output shows: `"N assignment(s) have unprocessed captures (showing oldest 5)"`

This prevents payload/console bloat as backlog grows.

## Not changed
- Heuristic algorithms — same logic, combined output
- `knowledge/.processed_captures.json` format — same tracking, marks both types at once
- Per-assignment capture workflow — still produces same diff files
