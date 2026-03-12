# Design: Discussions + .current pointer

## Overview

SpecDev currently conflates brainstorming and assignment execution. When multiple assignments exist, heuristic auto-detection of the "current" assignment confuses agents. This refactor introduces two changes:

1. **Discussions** — a new pre-assignment concept under `.specdev/discussions/` for brainstorming. Discussions have their own IDs (`D0001`, `D0002`, ...), follow the brainstorm skill exactly, and multiple can run in parallel. They require an explicit `--discussion` flag on all commands.

2. **`.current` pointer for assignments** — a `.specdev/.current` file that tracks the active assignment. Set automatically by `specdev assignment` on creation, or manually via `specdev focus <id>`. All assignment commands read `.current`. Eliminates heuristic auto-detection entirely.

When a discussion matures, `specdev assignment "description" --discussion D0001` copies brainstorm artifacts into the new assignment. Normal brainstorm gates still apply — the discussion gives a head start, not a free pass.

## Non-Goals

- Not changing the assignment phase workflow (brainstorm → breakdown → implement → summary)
- Not adding inter-discussion dependencies or linking discussions to each other
- Not adding collaborative/multi-user discussion features

## Design

### New concept: Discussions

- **Storage:** `.specdev/discussions/D0001_slug/` with `brainstorm/` subdirectory
- **ID format:** `D` prefix + 4-digit number (e.g., `D0001`)
- **New command:** `specdev discuss "description"` — reserves a discussion ID, creates the folder
- **Artifacts:** Same as brainstorm phase — `proposal.md` + `design.md`
- **Always explicit:** Commands use `--discussion D0001` flag, no auto-detection
- **Review:** `specdev reviewloop discussion --discussion D0001`
- **Checkpoint:** `specdev checkpoint discussion --discussion D0001`

#### Discussion CLI contract & error cases

| Scenario | Behavior |
|----------|----------|
| `--discussion` omitted on discussion command | Error: `--discussion flag is required. Use specdev discuss --list to see available discussions.` |
| Unknown ID (e.g., `--discussion D9999`) | Error: `Discussion D9999 not found. Available: D0001_slug, D0002_slug` |
| Malformed ID (e.g., `--discussion foo`) | Error: `Invalid discussion ID "foo". Expected format: D0001` |
| Folder exists but missing brainstorm files | Error: `Discussion D0001 has no brainstorm artifacts. Run brainstorm first.` (for checkpoint/review commands) |
| `specdev discuss --list` | List all discussions with their slugs |

### New concept: `.current` pointer

- **File:** `.specdev/.current` containing the active assignment name (e.g., `00003_refactor_mandatory-assignment-flag`)
- **Set by:**
  - `specdev assignment` — automatically on creation
  - `specdev focus <id>` — manual switch between existing assignments
- **Read by:** All assignment commands as default (`continue`, `checkpoint`, `approve`, `review`, `reviewloop`, `check-review`, `implement`)
- **Clear:** `specdev focus --clear`
- **Error:** When `.current` is not set and an assignment command is run, error with a clear message telling user to run `specdev focus`

#### `.current` file semantics & error cases

| Scenario | Behavior |
|----------|----------|
| `.current` missing | Error: `No active assignment. Run specdev focus <id> to set one.` Lists available assignments. |
| `.current` points to deleted/missing assignment | Error: `Assignment "00005_..." not found. Run specdev focus <id> to set a valid assignment.` Clears the stale pointer. |
| `.current` contains empty/corrupt content | Error: `Invalid .current file. Run specdev focus <id> to fix.` Deletes the file. |
| `specdev focus <id>` with unknown ID | Error: `Assignment not found. Available: 00001_..., 00002_...` |
| File format | Plain text, single line: the assignment folder name (e.g., `00003_refactor_mandatory-assignment-flag`) |
| Write strategy | Simple `fs.writeFileSync` — this is a single-user CLI tool, concurrent writes are not a realistic scenario. Last writer wins. |

### Promotion: Discussion → Assignment

- `specdev assignment "description" --discussion D0001`
- Copies `D0001`'s `brainstorm/` contents into the new assignment's `brainstorm/`
- Does NOT auto-approve brainstorm — normal gates still apply
- Agent refines the brainstorm artifacts in the assignment context

### Removed: Heuristic auto-detection

- Remove state-priority scoring from `scan.js`
- Remove temporal tie-breaking logic
- Remove `--assignment` flag from all commands (no longer needed)
- When `.current` is not set, commands error telling user to run `specdev focus`

### Key decisions

| Decision | Reasoning |
|----------|-----------|
| Discussions use `D` prefix IDs | Distinguishes from assignment IDs, avoids numbering conflicts |
| `.current` set automatically on `specdev assignment` | Eliminates extra step for agents, common flow just works |
| `--discussion` always required | Multiple discussions can run in parallel, no ambiguity |
| No `--assignment` flag | `.current` is the single source of truth, `specdev focus` to switch |
| Promotion doesn't skip gates | Discussion brainstorm may be raw, still needs review in assignment context |
| Hard break, no deprecation | This is an internal tool with no external consumers. Clean removal of `--assignment` is preferred over deprecation aliases. |

### Implementation order

This is a single assignment but implementation should be staged:
1. **`.current` pointer + `specdev focus`** — add the file, the command, update all assignment commands to read it
2. **Remove heuristic auto-detection** — remove `scan.js` scoring, remove `--assignment` flag
3. **Discussions** — add `specdev discuss`, discussion storage, `--discussion` flag, checkpoint/review support
4. **Promotion** — add `--discussion` flag to `specdev assignment` for copying artifacts

## Success Criteria

1. `specdev discuss "desc"` creates a discussion folder with `D####` ID under `.specdev/discussions/`
2. Discussion commands (`checkpoint discussion`, `reviewloop discussion`) require `--discussion` flag and work correctly
3. `specdev assignment "desc"` creates an assignment and sets `.current` automatically
4. `specdev assignment "desc" --discussion D0001` copies brainstorm artifacts from the discussion into the new assignment
5. All assignment commands read `.current` — no `--assignment` flag needed
6. `specdev focus <id>` switches `.current` between existing assignments
7. When `.current` is not set and an assignment command is run, clear error message telling user to run `specdev focus`
8. Heuristic auto-detection in `scan.js` is removed
9. Existing tests updated, new tests for discussions and `.current` functionality
