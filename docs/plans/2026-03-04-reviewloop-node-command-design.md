# Reviewloop Node Command Design

## Goal

Replace the bash-script-based reviewloop with a Node CLI command that orchestrates automated reviews by wrapping `specdev review`, with auto-approval on pass. Simplify review artifacts to two append-only files with clear ownership. Unify manual and automated review formats.

## Architecture

The reviewloop becomes a thin orchestrator over existing commands:

```
specdev reviewloop <phase>
  → resolve assignment
  → list available reviewers, ask user to select one
  → check if review-feedback.md exists with unaddressed findings → block if so
  → derive round from review/review-feedback.md (count ## Round headers, or start at 1)
  → set env vars: SPECDEV_PHASE, SPECDEV_ASSIGNMENT, SPECDEV_ROUND
  → spawn reviewer command (e.g. codex exec --full-auto --ephemeral)
  → read review-feedback.md for latest round's verdict
  → pass → call approvePhase() helper internally, print "Review passed. Phase approved."
  → fail + under max rounds → print "Review failed. Run specdev check-review to address findings."
  → fail + at max rounds → print "Max rounds reached. Escalating to user."
```

## Agent Communication

Two files with clear ownership, both append-only with `## Round N` headers:

- `review/review-feedback.md` — review agent writes findings, uses `[FN.X]` tags (F=finding, N=round, X=item)
- `review/changelog.md` — main agent writes what it fixed, references `[FN.X]` tags

**Hard rule:** Each agent only writes to its own file and reads the other's. No archiving, no renaming, no per-round files.

### Example format

**review-feedback.md** (review agent writes):
```markdown
## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] proposal.md is incomplete — single-line placeholder
2. [F1.2] BBG rename scope is inconsistent around config commands

### Addressed from changelog
- (none — first round)
```

**changelog.md** (main agent writes):
```markdown
## Round 1

### Changes
1. [F1.1] Expanded proposal.md with full problem framing and constraints
2. [F1.2] Clarified rename scope — added config commands to the list
```

**review-feedback.md round 2** (review agent appends):
```markdown
## Round 2

**Verdict:** approved

### Findings
- (none)

### Addressed from changelog
- [F1.1] ✓ proposal.md now complete
- [F1.2] ✓ rename scope clarified
```

## Round Detection

Round number is derived from the `review-feedback.md` file by counting `## Round` headers. If the file doesn't exist, round is 1. The reviewloop command owns the round counter and passes it via env var.

**Stale feedback guard:** Before spawning the reviewer, reviewloop checks if the latest round in `review-feedback.md` has verdict `needs-changes` without a corresponding `## Round N` entry in `changelog.md`. If so, it blocks and tells the main agent to run `check-review` first.

## Reviewer Selection

Reviewloop accepts an optional `--reviewer <name>` flag:
- **Without `--reviewer`:** lists available reviewers, tells agent to ask the user which to use, exits. Agent asks user, then re-runs with `--reviewer <name>`.
- **With `--reviewer`:** proceeds with the review.

This enforces user awareness — the agent must ask the user before proceeding, even if only one reviewer exists.

## Reviewer Config

Environment variables passed to the command (no template syntax):

```json
{
  "name": "codex",
  "command": "codex exec --full-auto --ephemeral \"Run specdev review $SPECDEV_PHASE --assignment $SPECDEV_ASSIGNMENT --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

`pass_pattern` and `fail_pattern` removed from config — verdict is parsed from the review artifact.

## Changes

### New: `src/utils/approve-phase.js`
Extract approve validation + status.json update into a shared helper:
- `approvePhase(assignmentPath, phase)` — validates artifacts, updates status.json, returns success/failure
- Both `approveCommand` and reviewloop call this helper
- Each caller controls its own output messaging

### Rewrite: `src/commands/reviewloop.js`
Currently a "signal to agent" that prints instructions. Rewrite to a Node command that:
- Resolves assignment (same pattern as other commands)
- Lists available reviewers from `.specdev/skills/core/reviewloop/reviewers/*.json`
- Prints reviewer list and asks user to select (even if only one)
- Derives round number from `review/review-feedback.md` (counts `## Round` headers, or starts at 1)
- Checks stale feedback guard (latest round has `needs-changes` but no changelog entry)
- Reads selected reviewer config
- Exports `SPECDEV_PHASE`, `SPECDEV_ASSIGNMENT`, `SPECDEV_ROUND` as env vars
- Spawns the reviewer command as a child process
- After exit: validates that expected `## Round N` appeared in `review-feedback.md`
- Parses verdict from the latest round
- Pass → calls `approvePhase()` helper, prints "Review passed. Phase approved."
- Fail + under max rounds → prints "Review failed. Run specdev check-review to address findings."
- Fail + at max rounds → prints "Max rounds reached. Escalating to user."

### Modified: `src/commands/approve.js`
- Extract validation + status.json logic into `src/utils/approve-phase.js`
- `approveCommand` becomes a thin wrapper that calls `approvePhase()` and prints output

### Modified: `src/commands/review.js`
- Unify manual and automated review to use the same append-only format
- Add `--round N` flag (optional — auto-detected from file if not provided)
- Instructions tell reviewer to append `## Round N` with `[FN.X]` tagged findings
- On round 2+: instruct reviewer to read `changelog.md` for what was fixed
- When `--round` is present: don't mention `specdev review done` in instructions
- Remove `detectNextRound()` function and per-round file references (`feedback-round-N.md`, `update-round-N.md`)
- Remove `review done` subcommand entirely (drop `reviewDoneCommand` function)

### Rewrite: `src/commands/check-review.js`
Simplify to:
- Read `review/review-feedback.md`, parse latest `## Round N` for verdict and findings
- Present findings to main agent
- If verdict is `needs-changes`: instruct main agent to fix issues and append to `review/changelog.md` under `## Round N`
- If verdict is `approved`: tell main agent to run `specdev approve <phase>`
- Remove archiving logic (`safeArchiveName`, `feedback-round-N.md` creation, file deletion)
- Remove `update-round-N.md` stub creation

### Modified: `src/commands/continue.js`
- Replace `fse.pathExists(feedbackPath)` with a helper that reads the latest round's verdict
- Three states: file doesn't exist (no review), latest verdict `needs-changes` (pending action), latest verdict `approved` (no action needed)

### Modified: `src/utils/update.js`
- Add `skills/core/reviewloop/scripts` to `removePaths` so `specdev update` cleans up the old bash script from existing installations

### Modified: `src/commands/checkpoint.js`
Already done — shows reviewloop/review/approve options in output.

### Modified: `src/commands/help.js`
- Remove `review done` from help text
- Update reviewloop description

### Modified: `templates/.specdev/skills/core/reviewloop/reviewers/codex.json`
Updated command to use env vars and `specdev review`.

### Modified: `templates/.specdev/skills/core/reviewloop/SKILL.md`
Updated to reflect new flow: just run the CLI command, no manual script invocation.

### Removed: `templates/.specdev/skills/core/reviewloop/scripts/reviewloop.sh`
Replaced by the Node command.

## Error Handling

- **Codex crashes/times out:** reviewloop checks that expected `## Round N` appeared in `review-feedback.md`. If not, prints error — same round can be retried.
- **Stale feedback:** reviewloop blocks if previous round's findings haven't been addressed (no changelog entry). Tells main agent to run `check-review`.
- **Max rounds reached:** escalate to user, don't auto-approve.
- **Reviewer config missing or invalid:** clear error message.

## Removed

- `specdev review done` — dropped entirely (unused in manual flow, not needed in automated flow)
- `templates/.specdev/skills/core/reviewloop/scripts/reviewloop.sh` — replaced by Node command
- Per-round file archiving (`feedback-round-N.md`, `update-round-N.md`, `safeArchiveName`)

## Unchanged

- Workflow guide and SKILL.md references to reviewloop

## Non-Goals

- Supporting interactive/persistent codex sessions across rounds
- Keeping the bash reviewloop.sh script
- Migration for old-format review files (orphaned `feedback-round-N.md` / `update-round-N.md` are harmless)
