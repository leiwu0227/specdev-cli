---
name: reviewloop
description: Automated external review loop — spawns external CLI reviewer, reads verdict from artifacts, auto-approves on pass
type: core
phase: brainstorm, implement
input: Completed work (code changes, design docs, etc.)
output: Review verdict in review/{phase}-feedback.md
next: auto-approve on pass, check-review on fail
triggers:
  - after brainstorm checkpoint passes
  - after implementation checkpoint passes
  - when user requests automated external review
---

# Reviewloop — Automated External Review

Run an external CLI reviewer (Codex, OpenCode, Aider, etc.) against the current assignment. The CLI command handles all mechanics: spawn reviewer, read verdict from artifacts, enforce round limits, auto-approve on pass.

## Usage

```bash
specdev reviewloop <phase>
specdev reviewloop <phase> --reviewer=<name>
```

Without `--reviewer`: lists available reviewers. Ask the user to select one.
With `--reviewer`: spawns the reviewer and processes the result.

## Review Artifacts

Two append-only files with clear ownership:

- `review/{phase}-feedback.md` — review agent writes findings (append `## Round N`)
- `review/{phase}-changelog.md` — main agent writes what it fixed (append `## Round N`)

Each agent only writes to its own file and reads the other's.

## Flow

1. Run `specdev reviewloop <phase>` — lists reviewers
2. Ask user which reviewer to use
3. Run `specdev reviewloop <phase> --reviewer=<name>`
4. Command spawns reviewer, waits for completion
5. Reads verdict from `review/{phase}-feedback.md`
6. **Pass** → auto-approves phase, proceed to next phase
7. **Fail** → run `specdev check-review` to read findings, fix issues, write `{phase}-changelog.md`
8. Re-run `specdev reviewloop` for next round

## Hard Rules

1. **Never skip check-review** — always read findings before the next round
2. **Never argue with findings** — fix what the reviewer says or escalate to the user
3. **Never exceed max rounds** — when max is reached, stop and defer to the user
