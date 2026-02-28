# Implementation Speedup — Design

**Date:** 2026-02-28

**Goal:** Speed up the implementation phase by reducing unnecessary reviewer subagent dispatches and adding batch execution.

## Two Changes

### 1. Smart Review Skipping (Task Mode System)

Add `standard` as the new default mode between `full` and `lightweight`:

| Mode | TDD | Reviewer subagent | Self-review | When |
|------|-----|-------------------|-------------|------|
| `full` | yes | yes (unified spec+quality) | yes | Complex/risky tasks |
| `standard` | yes | no | yes | Most tasks (new default) |
| `lightweight` | no | no | yes | Trivial scaffold/config |

**Mode assignment rules for breakdown — a task gets `full` when ANY apply:**
- Touches 3+ files
- Introduces new architecture (new module, new pattern)
- Security-sensitive (auth, input validation, crypto)
- Integration-heavy (wiring multiple components together)
- Last task in the plan (catches accumulated drift)

Everything else defaults to `standard`. `lightweight` stays for trivial scaffold/config only.

### 2. Batch Execution

Group tasks into batches of 3 instead of reporting after every task.

**Per-batch flow:**
1. Execute tasks sequentially within the batch (each follows its mode)
2. After batch completes, run full test suite once
3. Report batch summary: what was built, tests passing, decisions made
4. Continue to next batch — no user gate, informational only

**Edge cases:**
- Test suite fails after batch: stop, debug, fix before continuing
- Last batch may have fewer than 3 tasks
- `full` mode tasks still dispatch reviewer inline within the batch

## Files Changed

All in `templates/.specdev/`:

1. **`skills/core/breakdown/SKILL.md`** — Add `standard` mode, update mode assignment guidance, change default from `full` to `standard`
2. **`skills/core/implementing/SKILL.md`** — Add `standard` mode handling, add batch grouping logic, update reporting to per-batch
3. **`_guides/workflow.md`** — Update Phase 3 description

No CLI code changes. No new scripts. No prompt changes.
