---
name: autoloop
description: Automated external review loop — invoke external CLI reviewer, fix issues, resubmit until pass
type: tool
phase: implement
input: Completed work (code changes, design docs, etc.)
output: Review verdict (pass/fail) with findings
next: continue current workflow
triggers:
  - after implementation tasks complete
  - after brainstorm design finishes
  - when user requests external review
---

# Autoloop — Automated External Review

Invoke an external CLI reviewer (Codex, OpenCode, Aider, etc.) in an automated fix-resubmit loop. The script handles mechanics (invoke CLI, parse pass/fail, enforce round limits). You handle judgment (what to fix, how to fix it).

## Setup

Reviewer configs live in `reviewers/` next to this file. Each is a JSON file. Two patterns:

**Pattern 1: Let the CLI explore (recommended)**

The reviewer CLI runs in the project directory and explores the repo itself. Simpler, and the CLI can read files, run tests, and understand full context:

```json
{
  "name": "codex",
  "command": "codex -q --prompt 'Review the uncommitted changes in this repo. If acceptable, reply PASS. If issues found, describe them.'",
  "scope": "diff",
  "max_rounds": 3
}
```

**Pattern 2: Pipe context into the CLI**

The script assembles the code context (diff, file contents) and passes it to the CLI via an env var. Use this when the CLI doesn't have repo access or you want to control exactly what it sees:

```json
{
  "name": "codex-with-context",
  "command": "codex -q --prompt \"$AUTOLOOP_PROMPT\"",
  "scope": "diff",
  "max_rounds": 3
}
```

Copy an example config, remove the `.example` suffix, and adjust for your reviewer.

**Environment variables** available to your command:
- `$AUTOLOOP_PROMPT` — the full review prompt with code context baked in
- `$AUTOLOOP_CONTEXT` — just the code context (diff, file contents, or custom text)
- `$AUTOLOOP_CONTEXT_FILE` — path to a temp file containing the context
- `$AUTOLOOP_FILES` — list of changed file paths

**Config fields:**
- `command` (required) — shell command to run
- `scope` — what context to assemble: `diff` (default), `files`, `custom`
- `max_rounds` — max fix-resubmit cycles before escalating (default: 3)
- `pass_pattern` — regex to detect pass (default: `LGTM|no issues|approved|pass|PASS`)
- `fail_pattern` — regex to detect fail, checked first (default: `needs changes|issues found|fail|reject`)

## Protocol

### Step 1: Prompt the user

When your work is ready for review, ask:

> "Work is ready for external review. Which reviewer would you like to use?"

List available reviewers by checking `reviewers/*.json` (exclude `.example.json` files). If none exist, tell the user to copy an example config and customize it.

### Step 2: Ask scope

> "What should I send for review?"

Options:
- **diff** (default) — git diff of current changes
- **files** — full content of changed files
- **custom** — you select specific files or code to send

### Step 3: Run the loop

Execute the script:

```bash
bash scripts/autoloop.sh --reviewer <name> --round 1 --scope <scope>
```

The script returns JSON:

```json
{
  "verdict": "pass|fail",
  "round": 1,
  "max_rounds": 3,
  "escalate": false,
  "findings": "reviewer output text"
}
```

### Step 4: Handle the result

- **verdict = pass** — Report success to user. Continue with workflow.
- **verdict = fail, escalate = false** — Read `findings`. Fix the issues. Re-run with `--round N+1`.
- **verdict = fail, escalate = true** — STOP. Show all findings to the user. Ask how to proceed. Do NOT continue fixing on your own.

## Hard Rules

1. **Never skip a round** — always re-run the script after fixing issues
2. **Never argue with findings** — fix what the reviewer says or escalate to the user
3. **Never modify the verdict** — the script decides pass/fail, not you
4. **Never exceed max rounds** — when escalate is true, stop and defer to the user
