---
name: breakdown
description: Turn a validated design into bite-sized executable steps — automatic, no user interaction
---

# Breakdown

## Contract

- **Input:** `brainstorm/design.md` from the assignment folder
- **Process:** Read design → decompose into tasks → detail each task with TDD steps, exact code, exact commands
- **Output:** `breakdown/plan.md` in the assignment folder
- **Next phase:** implementing (automatic)

## Process

### Phase 1: Read Design

1. Read `brainstorm/design.md` from the assignment folder
2. Identify all components, features, and behaviors described
3. Understand the architecture and how pieces connect
4. Note the testing approach and success criteria

### Phase 2: Decompose

Break the design into ordered tasks. Each task should be:

- **2-5 minutes of work** — one logical unit
- **Independent enough to commit** — each task produces working code
- **Ordered by dependency** — later tasks build on earlier ones

### Phase 3: Detail Each Task

Every task MUST follow this structure:

    ### Task N: [Component Name]

    **Files:**
    - Create: `exact/path/to/file.ext`
    - Modify: `exact/path/to/existing.ext`
    - Test: `tests/exact/path/to/test.ext`

    **Step 1: Write the failing test**
    [Complete test code in a fenced code block]

    **Step 2: Run test to verify it fails**
    Run: `exact command`
    Expected: FAIL with "specific error message"

    **Step 3: Write minimal implementation**
    [Complete implementation code in a fenced code block]

    **Step 4: Run test to verify it passes**
    Run: `exact command`
    Expected: PASS

    **Step 5: Commit**
    [Exact git commands with commit message]

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
4. Write `review/ready-for-review.md` with phase: breakdown
5. Check for `review/watching.json`:
   - If present: run `implementing/scripts/poll-for-feedback.sh` and wait
   - If absent: proceed to implementing phase immediately

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
- Missing file paths — every file must have an exact path
- Tasks that don't commit — every task is an atomic commit

## Integration

- **Before this skill:** brainstorming (produces the design this skill reads)
- **After this skill:** implementing (executes the plan)
- **Review:** Review agent may check the plan before implementation starts
