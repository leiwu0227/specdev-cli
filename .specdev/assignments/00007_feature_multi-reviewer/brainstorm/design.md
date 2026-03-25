# Design: Multi-Reviewer Support

## Overview

Enable `specdev reviewloop <phase> --reviewer=codex,claude` to run multiple reviewers in succession. Each reviewer gets its own independent round counter and separate feedback file. The phase is approved only after all listed reviewers have approved. Re-running the command resumes from where it left off — already-approved reviewers are skipped.

## Goals

- Support comma-separated `--reviewer=a,b,c` syntax for running multiple reviewers sequentially
- Each reviewer runs its full cycle (up to its own max_rounds) independently
- Independent round counters — each reviewer starts at round 1 with architecture focus
- Separate feedback files per reviewer (`{phase}-feedback-{reviewer}.md`)
- Phase approval only after all listed reviewers approve
- Resume capability — skip already-approved reviewers on re-run

## Non-Goals

- No parallel/concurrent reviewer execution — strictly sequential
- No changes to single-reviewer behavior (backwards compatible)
- No changes to the review focus system or reviewer configs
- No changes to manual `specdev review` — this is reviewloop only

## Design

### Syntax

```
specdev reviewloop brainstorm --reviewer=codex,claude
specdev reviewloop implementation --reviewer=cursor,claude
```

Single reviewer still works: `--reviewer=codex` (no behavior change).

### Feedback File Naming

Current (single reviewer): `{phase}-feedback.md`
New (multi-reviewer): `{phase}-feedback-{reviewer}.md`

Examples:
- `brainstorm-feedback-codex.md`
- `brainstorm-feedback-claude.md`

**Backwards compatibility:** When a single reviewer is specified (no comma), continue using the current `{phase}-feedback.md` naming. Multi-reviewer mode uses the reviewer-suffixed naming.

Similarly for changelog files:
- Single: `{phase}-changelog.md`
- Multi: `{phase}-changelog-{reviewer}.md`

### Execution Flow

```
for each reviewer in comma-separated list:
  1. Check if reviewer already approved (latest round in feedback file has verdict: approved)
     → if yes, print "Reviewer X already approved, skipping" and continue to next
  2. Run reviewer's full cycle:
     a. Determine round number from existing feedback file
     b. Check max_rounds not exceeded
     c. Resolve SPECDEV_FOCUS for current round
     d. Spawn reviewer subprocess with env vars
     e. Read verdict from feedback file
     f. If "approved" → continue to next reviewer
     g. If "needs-changes" → stop, tell user to run check-review
        (next re-run will skip approved reviewers and resume here)
  3. After all reviewers approved → approve phase
```

### Changes to reviewloop.js

The main change is in the reviewer execution section. When `--reviewer` contains a comma:

1. Split on comma to get reviewer list: `const reviewers = flags.reviewer.split(',')`
2. For each reviewer, run the existing review logic but with reviewer-specific feedback/changelog paths
3. Track which reviewers have been approved
4. Only call `approvePhase()` when all reviewers are approved

When `--reviewer` is a single value (no comma), behavior is unchanged — uses existing `{phase}-feedback.md` naming.

### Stale-Findings Guard

The existing `hasUnaddressedFindings()` check is applied **per reviewer** against that reviewer's specific feedback/changelog files. Reviewer B is not blocked by reviewer A's unaddressed findings — each reviewer's guard is independent.

In single-reviewer mode, the guard continues to use `{phase}-feedback.md` / `{phase}-changelog.md` as before.

### Max Rounds Exhaustion

When a reviewer reaches `max_rounds` with `needs-changes`, the behavior matches current single-reviewer behavior: `console.error('Max rounds reached. Escalating to user.')` and `process.exitCode = 1`. The chain stops — subsequent reviewers do not run.

### Changes to check-review.js

When multi-reviewer feedback files exist, `check-review` needs to know which reviewer's findings to read.

**Chosen approach:** Explicit `--reviewer` flag. `specdev check-review <phase> --reviewer=<name>` reads `{phase}-feedback-{name}.md`. When `--reviewer` is omitted, falls back to `{phase}-feedback.md` (single-reviewer mode). If neither exists, scan for `{phase}-feedback-*.md` files and pick the first one with a `needs-changes` verdict (sorted alphabetically by reviewer name).

### Environment Variables

No new env vars needed. Existing vars passed to each reviewer subprocess:
- `SPECDEV_PHASE`, `SPECDEV_ASSIGNMENT`, `SPECDEV_ROUND`, `SPECDEV_FOCUS`
- `SPECDEV_DISCUSSION` (for discussion reviewloop)

### Reviewer Listing (no --reviewer flag)

When `--reviewer` is omitted, the existing behavior is unchanged — list available reviewers and exit. No changes needed.

### Discussion Reviewloop

Same changes apply to the discussion path in `reviewloop.js`. The discussion path already mirrors the assignment path structure.

**Note:** The discussion path currently hardcodes `brainstorm-feedback.md` (line 114). This is an existing bug but fixing it is **out of scope** for this assignment — it would be a separate bugfix.

**Discussion approval:** The discussion path does not call `approvePhase()`. In multi-reviewer mode for discussions, the chain completes when all reviewers approve and prints "Discussion review approved!" — no phase approval call needed (consistent with current behavior).

## Success Criteria

1. `--reviewer=codex,claude` runs codex first (full cycle), then claude (full cycle)
2. Each reviewer gets independent round counter starting at 1
3. Separate feedback files: `{phase}-feedback-{reviewer}.md`
4. Phase approved only after all reviewers approve
5. Re-running skips already-approved reviewers
6. Single `--reviewer=codex` still works unchanged (backwards compatible)
7. `check-review` auto-detects which reviewer's findings to show
8. `needs-changes` from any reviewer stops the chain
9. Existing tests continue to pass

## Testing Approach

- Test comma parsing: `codex,claude` → `['codex', 'claude']`
- Test feedback file naming: single reviewer uses `{phase}-feedback.md`, multi uses `{phase}-feedback-{reviewer}.md`
- Test skip logic: approved reviewer is skipped on re-run
- Test chain stop: `needs-changes` stops execution before next reviewer
- Test phase approval: only when all reviewers approved
- Test backwards compatibility: single reviewer works unchanged
