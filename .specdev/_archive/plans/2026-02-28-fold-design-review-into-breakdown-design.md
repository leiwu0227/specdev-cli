# Fold Design Review into Breakdown — Design

**Date:** 2026-02-28

**Goal:** Remove "auto review" as a user-facing concept. Move the design review into breakdown as an internal quality step the agent runs silently before decomposing tasks.

## Problem

After brainstorm, the agent tells the user to say "auto review" to trigger a design review before breakdown. In practice, the agent forgets this step or the user doesn't know what "auto review" means. The design review should happen automatically inside breakdown, invisible to the user.

## Approach

Text-only changes to 3 SKILL.md files and 1 guide. No CLI code changes.

## Flow (after)

```
Brainstorm complete → Agent says "Run specdev approve brainstorm when ready"
→ User runs specdev approve brainstorm (explicit user gate)
→ Agent starts breakdown:
    1. Design review (subagent, up to 2 rounds, silent)
    2. Decompose into tasks
    3. Plan review (subagent, 1-2 rounds)
    4. Chain into implementation
```

## File Changes

### 1. `skills/core/brainstorming/SKILL.md` — Phase 4

Remove "auto review" language. Replace with:
- Announce design complete
- Tell user to run `specdev approve brainstorm` when ready
- Do not proceed until user has approved
- Remove "auto review" from the "After stopping" options

### 2. `skills/core/breakdown/SKILL.md` — New Phase 1: Design Review

Add before current Phase 1 (shift existing phases down):
- Dispatch subagent to review `brainstorm/design.md`
- Review criteria: goal/architecture/success criteria clarity, obvious gaps, scope boundedness, decisions documented
- Does NOT check code-level details or second-guess the chosen approach
- If issues found: fix design.md silently, re-review (max 2 rounds)
- If still failing after 2 rounds: surface to user and pause
- Intentionally lightweight — design was already validated with user during brainstorm

### 3. `_guides/workflow.md` — Phase 2 update

Update breakdown description to mention both internal reviews: design review (1-2 rounds) then plan review (1-2 rounds).

## What stays the same

- `specdev approve brainstorm` — user-initiated gate, no code changes
- CLI commands (approve.js, check-review.js, dispatch.js) — untouched
- Plan review inside breakdown — still there, separate from design review
- Review agent (`specdev review brainstorm` in separate session) — still optional
- `_main.md` — no changes needed
