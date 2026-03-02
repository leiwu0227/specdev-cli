# Autoloop: Automated External Review Loops

**Date:** 2026-03-01

## Problem

The current review system (`specdev review`) requires a separate manual session where a human guides the review agent. While thorough, this creates friction for iterative code quality checks. Meanwhile, external CLI tools (Codex, OpenCode, Aider, etc.) can provide fast, independent code review — but integrating them requires manual copy-paste between tools.

The idea: let the agent invoke an external CLI reviewer, read the findings, fix issues, and resubmit — in an automated loop — until the reviewer passes or a round limit is hit.

## Inspiration

Cross-model review (using a different AI to review code) catches things self-review misses due to different model biases. The original idea comes from a Claude+Codex collaboration pattern, but the design is deliberately CLI-agnostic.

## Solution

A **hybrid tool skill**: a SKILL.md protocol that tells the agent how to run the loop, backed by a **deterministic shell script** that handles the mechanical parts (invoking the CLI, parsing pass/fail, enforcing round limits). The agent handles judgment calls (what to fix, how to fix it). The script handles hard decisions (pass or fail, escalate or continue).

### Why Hybrid

| Concern | Agent-driven (skill only) | Script-driven (CLI only) | Hybrid |
|---------|--------------------------|--------------------------|--------|
| Invoking external CLI | Agent runs shell command | Script runs it | Script |
| Parsing pass/fail | LLM interprets output (unreliable) | Code matches patterns (deterministic) | Script |
| Deciding what to fix | LLM reads findings (good at this) | Can't do this | Agent |
| Enforcing round limits | LLM might ignore (soft) | Code enforces (hard) | Script |
| Escalating to user | Agent can do this naturally | Awkward from script | Agent |

The split: **script does mechanics, agent does judgment**.

## Architecture

### File Structure

```
.specdev/skills/tools/autoloop/
├── SKILL.md                    # Protocol the agent follows
├── scripts/
│   └── autoloop.sh             # Deterministic engine
└── reviewers/
    └── codex.example.json      # Reference reviewer config
```

### Reviewer Config Format

Each reviewer is a JSON file in `reviewers/`. Users copy the example and customize.

```json
{
  "name": "codex",
  "command": "codex -q --prompt '{prompt}'",
  "scope": "diff",
  "max_rounds": 3,
  "pass_pattern": "LGTM|no issues|approved|pass",
  "fail_pattern": "needs changes|issues found|fail|reject"
}
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Human-readable label |
| `command` | yes | Shell command template. `{prompt}` replaced with review prompt + context. `{stdin}` means pipe context via stdin. `{files}` replaced with file paths. |
| `scope` | no | Default context scope: `diff` (git diff, default), `files` (full changed files), `custom` (agent provides context) |
| `max_rounds` | no | Max fix-resubmit cycles before escalating. Default: 3 |
| `pass_pattern` | no | Regex to detect pass in reviewer output. Default: `LGTM\|no issues\|approved\|pass` |
| `fail_pattern` | no | Regex to detect fail. Default: `needs changes\|issues found\|fail\|reject`. Checked before pass_pattern. |

### Script Interface

```bash
autoloop.sh --reviewer <name> --round <N> [--scope diff|files|custom] [--context <text>]
```

**Stateless.** The agent passes `--round N` each time. No state files, no cleanup.

**Process:**

1. Load `reviewers/<name>.json`
2. Assemble context based on scope:
   - `diff` → `git diff` (staged + unstaged)
   - `files` → full content of changed files (`git diff --name-only` then `cat` each)
   - `custom` → use `--context` argument
3. Build review prompt: "Review the following code changes. If acceptable, reply with PASS. If issues found, describe them."
4. Substitute `{prompt}`, `{files}`, `{stdin}` in command template
5. Execute command, capture stdout
6. Match output against `fail_pattern` first, then `pass_pattern`. If neither matches, default to fail.
7. Output JSON to stdout:

```json
{
  "verdict": "fail",
  "round": 1,
  "max_rounds": 3,
  "escalate": false,
  "findings": "The raw reviewer output text..."
}
```

When `round >= max_rounds` and verdict is fail, `escalate` becomes `true`.

### Skill Protocol (SKILL.md)

```yaml
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
```

**Agent protocol:**

1. **Prompt user** — "Work is ready for external review. Which reviewer would you like to use?" List available configs from `reviewers/` directory.
2. **Ask scope** — "What should I send for review?" Offer: git diff (default), full changed files, or let agent pick relevant files.
3. **Run loop** — Execute `scripts/autoloop.sh`, read JSON result.
4. **On fail** — Read `findings`, fix the issues, re-run with incremented round.
5. **On escalate** — Stop. Show accumulated findings to user. Ask how to proceed.
6. **On pass** — Report success, continue with workflow.

**Hard rules:**
- Never skip a round — always re-run the script after fixing
- Never argue with the reviewer output — fix what it says or escalate
- Never modify the verdict — the script decides pass/fail, not the agent

## Flow Diagram

```
Agent finishes work
  │
  ▼
Agent prompts user: "Ready for external review. Which reviewer?"
  │
  ▼
User picks reviewer (e.g. "codex")
  │
  ▼
Agent asks scope preference (diff / files / custom)
  │
  ▼
┌─── LOOP ────────────────────────────────┐
│                                          │
│  Agent runs: autoloop.sh                 │
│    --reviewer codex                      │
│    --round N                             │
│    --scope diff                          │
│         │                                │
│         ▼                                │
│  Script loads codex.json config          │
│  Script assembles context (git diff)     │
│  Script invokes: codex -q --prompt '...' │
│  Script captures output                  │
│  Script matches pass/fail patterns       │
│  Script returns JSON                     │
│         │                                │
│    ┌────┴────┐                           │
│    ▼         ▼                           │
│  PASS      FAIL                          │
│    │    ┌───┴───┐                        │
│    │    ▼       ▼                        │
│    │  rounds  rounds                     │
│    │  < max   >= max                     │
│    │    │       │                        │
│    │    ▼       ▼                        │
│    │  Agent   ESCALATE                   │
│    │  fixes   → show findings to user    │
│    │  code    → ask how to proceed       │
│    │    │                                │
│    │    └──── next round ────┐           │
│    │                         │           │
└────┼─────────────────────────┘           │
     │                                     │
     ▼                                     │
  Agent proceeds                    User decides
  with workflow                     next step
```

## Integration with Existing System

### What changes

- **New skill:** `.specdev/skills/tools/autoloop/` added to templates
- **Installation:** Standard `specdev skills install` path — wrappers generated for detected agents
- **Tracked in:** `active-tools.json` like any other tool skill

### What doesn't change

- `specdev review` — untouched, still works for manual human-guided review
- `specdev check-review` — untouched
- `specdev approve` — untouched
- `specdev checkpoint` — untouched (could optionally warn if autoloop is installed but not invoked, but not required for v1)

### Relationship to existing review

| Aspect | `specdev review` | Autoloop |
|--------|-------------------|----------|
| Trigger | User runs CLI command | Agent prompts user inline |
| Reviewer | Human-guided review agent | External CLI tool |
| Session | Separate Claude session | Same session |
| Depth | Thorough, multi-aspect | Fast, automated pass/fail |
| Loop | Manual re-review cycles | Automated fix-resubmit |
| Use case | Final quality gate | Iterative polish during development |

Both can be used on the same assignment. Autoloop for fast automated passes during implementation, `specdev review` for thorough human review before approval.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Skill type | Tool skill (hybrid) | Fits existing installation/wrapper system, keeps CLI scaffolds-only philosophy |
| Script role | Mechanics only | Deterministic pass/fail, no judgment calls |
| Agent role | Judgment only | Reads findings, decides fixes, never overrides verdict |
| Reviewer interface | Generic command + example | Maximum flexibility, zero adapter maintenance |
| Verdict model | Pass/fail only | Simpler than severity parsing, round limits handle iteration |
| State management | Stateless script | Agent passes round number, no cleanup needed |
| Review trigger | User-initiated via agent prompt | User stays in control of when and which reviewer |
| Fix responsibility | Same agent | Stays in session, mirrors existing review loop pattern |
| Escalation | After max rounds | Hard limit prevents infinite loops, user decides next step |
| Existing review system | Untouched | Autoloop is complementary, not a replacement |
