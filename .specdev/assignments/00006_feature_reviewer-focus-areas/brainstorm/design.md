# Design: Reviewer Focus Areas

## Overview

Add round-specific review focus instructions to the reviewloop system. A shared config file defines what each round should focus on. The instructions are passed to reviewer subprocesses via a `SPECDEV_FOCUS` environment variable. All reviewer JSON configs get `max_rounds` increased from 3 to 5.

## Goals

- Give reviewers targeted focus per round instead of generic "review everything" each time
- Increase max_rounds to 5 for all reviewers to support the expanded focus areas
- Keep focus instructions shared across all reviewers (not per-reviewer)
- Pass focus via `SPECDEV_FOCUS` env var so all reviewer CLIs can use it

## Non-Goals

- No per-reviewer custom focus instructions (shared config only)
- No changes to the review feedback format or verdict system
- No changes to manual review workflow or verdict format — `review.js` may display focus text when invoked via automated reviewloop, but the review process and output format remain unchanged

## Design

### Round Focus Definitions

| Round | Focus | Description |
|-------|-------|-------------|
| 1 | Architecture & structure | Modularity, separation of concerns, API design, dependency direction |
| 2 | Code efficiency | Dead code, loop optimization, magic numbers, functional style, Big O complexity |
| 3 | Domain & task-specific | Implementation matches spec/design, edge cases, error handling |
| 4-5 | General review | Catch-all for anything missed in previous rounds |

### Shared Focus Config

New file: `skills/core/reviewloop/review-focus.json`

```json
{
  "round_focus": {
    "1": "Architecture & structure — review modularity, separation of concerns, API design, and dependency direction. Identify structural issues.",
    "2": "Code efficiency — eliminate dead code, replace imperative loops with functional alternatives, extract magic numbers into constants, prefer pure functions with minimal side effects, verify Big O complexity of algorithms.",
    "3": "Domain & task-specific — verify implementation matches the spec/design, check edge cases, validate error handling.",
    "default": "General review — catch anything missed in previous rounds."
  }
}
```

Rounds 4+ use `"default"`.

### Environment Variable

`reviewloop.js` reads `review-focus.json`, resolves the current round's focus text, and sets:

```
SPECDEV_FOCUS="Architecture & structure — review modularity, separation of concerns, ..."
```

If the config file is missing or has no entry for the round, `SPECDEV_FOCUS` is set to an empty string (graceful degradation).

### Reviewer Config Changes

All reviewer JSON files get `max_rounds` changed from 3 to 5:
- `codex.json` (template + local)
- `cursor.json` (template + local)
- `cursor-gemini.json` (local only — not in templates)
- `claude.json` (template + local)

### File Locations

1. `templates/.specdev/skills/core/reviewloop/review-focus.json` — distributed via `specdev init`
2. `.specdev/skills/core/reviewloop/review-focus.json` — local project copy
3. All reviewer `.json` files in both template and local directories

### How It Works

1. `reviewloop.js` loads `review-focus.json` from the reviewloop directory (`skills/core/reviewloop/`). If the file is missing or contains invalid JSON, falls back to empty string (log a warning).
2. Looks up `round_focus[String(round)]`, falls back to `round_focus.default`, falls back to `""`
3. Sets `SPECDEV_FOCUS` in `childEnv` alongside existing `SPECDEV_PHASE`, `SPECDEV_ROUND`, etc.
4. Reviewer subprocess spawns `specdev review`, which reads `SPECDEV_FOCUS` from env
5. `review.js` displays the focus instruction in its output when `SPECDEV_FOCUS` is set (same pattern as existing `SPECDEV_DISCUSSION` env var reading), so the reviewer agent knows what to focus on

### Changes to review.js

When `process.env.SPECDEV_FOCUS` is set and non-empty, `review.js` includes a "Review Focus" section in its printed output:

```
Review Focus:
   Architecture & structure — review modularity, separation of concerns, ...
```

This appears after the existing review scope/instructions, before the reviewer begins writing feedback. This is the consumption point for the `SPECDEV_FOCUS` env var.

### Changes to reviewloop.js

Both the assignment path (line ~315) and discussion path (line ~141) need the same change:
1. Read `review-focus.json` from the reviewers' parent directory (`skills/core/reviewloop/`)
2. Resolve focus text for current round
3. Add `SPECDEV_FOCUS` to `childEnv`

## Success Criteria

1. All reviewer configs have `max_rounds: 5`
2. `review-focus.json` exists in both template and local directories
3. `SPECDEV_FOCUS` env var is set when spawning reviewer subprocesses
4. Round 1 gets architecture focus, round 2 gets efficiency focus, round 3 gets domain focus, rounds 4-5 get default
5. Missing or malformed `review-focus.json` doesn't break reviewloop (graceful fallback to empty string with warning)
6. `specdev init` copies `review-focus.json` to new projects
7. Existing tests continue to pass

## Testing Approach

- Test that `review-focus.json` is distributed via `specdev init`
- Test that reviewer configs have `max_rounds: 5`
- Test the focus resolution logic (round 1→architecture, round 2→efficiency, round 3→domain, round 4+→default, missing file→empty)
