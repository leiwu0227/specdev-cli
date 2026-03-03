---
name: reviewloop
description: Automated external review loop — invoke external CLI reviewer, fix issues, resubmit until pass
type: core
phase: implement
input: Completed work (code changes, design docs, etc.)
output: Review verdict (pass/fail) with findings
next: continue current workflow
triggers:
  - after implementation tasks complete
  - after brainstorm design finishes
  - when user requests external review
---

# Reviewloop — Automated External Review

Invoke an external CLI reviewer (Codex, OpenCode, Aider, etc.) in an automated fix-resubmit loop. The script handles mechanics (invoke CLI, parse pass/fail, enforce round limits). You handle judgment (what to fix, how to fix it).

## Setup

Reviewer configs live in `reviewers/` next to this file. Each is a JSON file. The reviewer CLI runs in the project directory and explores the repo itself — it can read files, run tests, and understand full context:

```json
{
  "name": "codex",
  "command": "codex exec review --uncommitted 'If acceptable, reply PASS. If issues found, describe them.'",
  "scope": "diff",
  "max_rounds": 3
}
```

A default Codex config is included. Copy and customize it for other reviewers.

**Config fields:**
- `command` (required) — shell command to run (the reviewer CLI explores the repo itself)
- `max_rounds` — max fix-resubmit cycles before escalating (default: 3)
- `pass_pattern` — regex to detect pass (default: `LGTM|no issues|approved|pass|PASS`)
- `fail_pattern` — regex to detect fail, checked first (default: `needs changes|issues found|\bfailed\b|\bfail\b|reject`)

## Protocol

### Step 1: Prompt the user

When your work is ready for review, ask which reviewer to use. List available reviewers by checking `reviewers/*.json`.

### Step 2: Run the loop

Execute the script:

```bash
bash .specdev/skills/core/reviewloop/scripts/reviewloop.sh --reviewer <name> --round 1
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

### Step 3: Handle the result

- **verdict = pass** — Report success to user. Continue with workflow.
- **verdict = fail, escalate = false** — Read `findings`. Fix the issues. Re-run with `--round N+1`.
- **verdict = fail, escalate = true** — STOP. Show all findings to the user. Ask how to proceed. Do NOT continue fixing on your own.

## Hard Rules

1. **Never skip a round** — always re-run the script after fixing issues
2. **Never argue with findings** — fix what the reviewer says or escalate to the user
3. **Never modify the verdict** — the script decides pass/fail, not you
4. **Never exceed max rounds** — when escalate is true, stop and defer to the user
