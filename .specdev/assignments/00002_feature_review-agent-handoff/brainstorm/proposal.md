# Proposal: Automated Review Agent Handoff

## Problem

Currently, SpecDev's Gates 3-4 (spec compliance + code quality review) happen either manually or within the same Claude Code session via subagent dispatch. This creates self-review bias — the same process that wrote the code is reviewing it.

## Solution

A file-based handoff protocol where the implementer signals "ready for review" and a separate reviewer agent (different process/session) picks it up, runs checks, and writes results back.

## Scope

1. **Handoff protocol** — `review_request.json` signal file with status lifecycle (`pending` → `in_progress` → `passed` / `failed`) and lock mechanism
2. **Deterministic gate check script** — `scripts/verify-gates.sh` for mechanical/structural pre-flight checks
3. **Reviewer agent skill** — `skills/review-agent.md` with instructions for the reviewer agent
4. **CLI command** — `specdev review` with subcommands: `request`, `status`, `run`, `watch`, `wait`, `pause`, `accept`, `reject`
5. **Template updates** — schema, report template, guide updates, skills README

## Value

- True separation of concerns between implementer and reviewer
- Eliminates self-review bias
- Mechanical pre-flight catches structural issues before AI review
- File-based protocol works across any two processes (no IPC needed)
- Fully autonomous: `watch` (reviewer) and `wait` (implementer) block/poll so neither session needs human coordination
- Resilient: `pause` resets interrupted reviews, all state is in JSON files
