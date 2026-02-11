# Planning Guide

**Reference Example**: See `_templates/assignment_examples/feature/00000_feature_email-validator/plan.md`

## Planning Phases

Iterate until user approves. Show progress update after each phase.

1. **Gather Information**: dependency check, read background, collect context
2. **Consolidate Findings**: synthesize into initial plan
3. **Identify Problems**: list issues needing user clarification
4. **Clarify with User**: resolve issues one by one
5. **Write Plan**: step-by-step plan, get user approval

Write research notes to `.specdev/assignments/#####_type_name/research.md`

---

## Task Granularity Gate

```
GATE: For each task in the plan, verify:
  1. Can this task be expressed as a single failing test?
     - YES → task is correctly sized
     - NO → decompose further until each sub-task maps to one test
  2. Does this task have a clear, binary success condition?
     - YES → keep it
     - NO → rewrite until pass/fail is unambiguous
  3. Can a subagent complete this task with ONLY its description + scaffold?
     - YES → context is sufficient
     - NO → add missing context to the task description
```

**Good Task Decomposition:**
```
T002: validate_email rejects missing @ symbol
  - Test: assert validate_email("userexample.com") == False
  - Impl: add @ check to validate_email
  - One behavior, one test, one code change

T003: validate_email rejects empty string
  - Test: assert validate_email("") == False
  - Impl: add empty-string guard
  - One behavior, one test, one code change
```

**Bad Task Decomposition:**
```
T002: Implement validate_email
  - Too broad — covers multiple behaviors in one task
  - Can't be expressed as a single failing test
  - Subagent won't know when it's "done"
```

---

## Verification

Before presenting the plan to the user, check:

- [ ] Every task maps to one Red-Green-Refactor cycle
- [ ] No task says "implement X and write tests" (tests are part of EACH task, not a separate step)
- [ ] Task ordering follows TDD sequence: setup → behavior slices → integration
- [ ] Each task description includes enough context for an isolated subagent

---

*Progress Update*
- [ ] Information Gathering
- [ ] Consolidate Findings
- [ ] Identifying Problems
- [ ] Clarification
- [ ] Write Plan
