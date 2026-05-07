---
name: specdev-reviewloop
description: Automated external review loop — spawns an external reviewer CLI, reads verdict, auto-approves on pass
---

## For assignments

Run `specdev reviewloop <phase>` where phase is `brainstorm` or `implementation`.

Without `--reviewer`: lists available reviewers. Ask the user which to use.
With `--reviewer=<name>`: spawns the reviewer and processes results automatically.

Flow:
1. `specdev reviewloop <phase>` — lists reviewers
2. Ask user which reviewer
3. `specdev reviewloop <phase> --reviewer=<name>` — runs review
4. On pass → auto-approves the phase. **The gate is satisfied — proceed immediately to the next phase.** Do NOT ask the user to run `specdev approve` separately.
5. On fail → run `specdev check-review <phase>` to address findings, then re-run reviewloop

## For discussions

Run `specdev reviewloop discussion --discussion=<ID>` where ID is the discussion ID (e.g. D00001).

Flow:
1. `specdev reviewloop discussion --discussion=<ID>` — lists reviewers
2. Ask user which reviewer
3. `specdev reviewloop discussion --discussion=<ID> --reviewer=<name>` — runs review
4. On pass → discussion review complete. No phase approval needed.
5. On fail → address findings, then re-run

**Do NOT use `specdev reviewloop brainstorm` for discussions — that requires an assignment.**

This is a Node.js CLI command — run it directly, never via pip/python.
