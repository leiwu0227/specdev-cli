---
name: breakdown
description: Turn a validated design into bite-sized executable steps — automatic, no user interaction
type: core
phase: breakdown
input: brainstorm/design.md
output: breakdown/plan.md
next: implementing
---

# Breakdown

## Contract

- **Input:** `brainstorm/design.md` from the assignment folder
- **Process:** Review design (subagent, up to 2 rounds) → decompose into tasks → detail each task with TDD steps, exact code, exact commands
- **Output:** `breakdown/plan.md` in the assignment folder
- **Next phase:** implementing (automatic)

## Process

### Phase 1: Design Review

Before decomposing, verify the design is complete enough to plan against. Dispatch a subagent to review `brainstorm/design.md`:

**Review criteria:**
- Are the goal, architecture, and success criteria clear and specific?
- Are there obvious gaps (missing error handling, unclear data flow, unaddressed edge cases)?
- Is the scope well-bounded (no vague "and more" items)?
- Are decisions documented with reasoning?

**Does NOT check:** code-level details or whether the design is the "best" approach (user already approved the direction).

**If issues found:**
1. Fix `brainstorm/design.md` directly — add missing sections, clarify vague language, tighten scope
2. Re-review (max 2 rounds total)
3. If still failing after 2 rounds: surface findings to user and pause

This is a lightweight sanity check — the design was already validated section-by-section with the user during brainstorm.

### Phase 2: Read Design and Decompose

1. Read `brainstorm/design.md` — understand the architecture, components, and success criteria
2. Break the design into ordered tasks. Each task should be:

- **2-5 minutes of work** — one logical unit
- **Independent enough to commit** — each task produces working code
- **Ordered by dependency** — later tasks build on earlier ones

### Phase 3: Detail Each Task

Every task MUST follow this structure (compact form shown):

    ### Task N: [Name]
    **Mode:** standard
    **Skills:** [skill-a, skill-b]
    **Files:** Create/Modify/Test with exact paths

    **Step 1: Write the failing test**
    [full test code block]

    **Step 2: Run test to verify it fails**
    Run: `exact command`
    Expected: FAIL with "specific error"

    **Step 3: Write minimal implementation**
    [full implementation code block]

    **Step 4: Run test to verify it passes**
    Run: `exact command`
    Expected: PASS

    **Step 5: Commit**
    [exact git commands + commit message]

Mode rules:
- `standard` (default): TDD + implementer self-review only — no reviewer subagent dispatched
- `full`: TDD + reviewer subagent (unified spec + quality review) — use when task is complex or risky
- `lightweight`: no TDD, no review — only for trivial scaffold/config with no executable behavior

Assign `full` when ANY of these apply:
- Task touches 3+ files
- Task introduces new architecture (new module, new pattern, new abstraction)
- Task is security-sensitive (auth, input validation, crypto)
- Task is integration-heavy (wiring multiple components together)
- Task is the last task in the plan (catches accumulated drift)

All other tasks default to `standard`. Use `lightweight` only for trivial scaffold/config.

**Skill declaration:** Run `specdev skills` to list available skills. Declare only what each task needs:

| Task involves | Declare skill |
|---------------|--------------|
| Writing new code | `test-driven-development` |
| Debugging | `systematic-debugging` |
| Project-specific tool | exact name from `specdev skills` |

### Phase 4: Write Plan

1. Write the plan with header:

```
# [Feature Name] Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** [One sentence from design]

**Architecture:** [2-3 sentences from design]

**Tech Stack:** [From design]

---
```

2. Write all tasks in order
3. Save to `breakdown/plan.md` in the assignment folder
4. A subagent review (1-2 rounds) will check the plan for completeness and correctness
   - If the review finds issues: address them and re-run the review
5. Once the plan review passes, start implementation immediately — no user approval needed:
   - Ensure `implementation/` directory and `implementation/progress.json` (`{}`) exist
   - Read `.specdev/skills/core/implementing/SKILL.md` and follow it
   - Do NOT stop, report, or wait for user input between plan completion and implementation start

## Rules

- Exact file paths always — never "add a test file"
- Complete code in plan — never "add validation logic"
- Exact commands with expected output — never "run the tests"
- Every task follows RED-GREEN-REFACTOR
- DRY, YAGNI — only what the design specifies
- Frequent commits — one per task

## Red Flags

- Vague task steps ("add error handling") — show the actual code
- Tasks longer than 5 minutes — break them down further
- Missing test steps — every task must have RED and GREEN

## Integration

- **Before this skill:** brainstorming (produces the design this skill reads)
- **After this skill:** implementing (auto-chains — proceed directly after plan review passes)
- **Review:** Design review (subagent, up to 2 rounds) runs first, then plan review (subagent, 1-2 rounds). Do NOT use `specdev review` here — proceed directly to implementing
