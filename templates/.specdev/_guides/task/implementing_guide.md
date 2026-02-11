# Implementation Guide

**Reference Example**: See `_templates/assignment_examples/feature/00000_feature_email-validator/implementation.md`

---

## The TDD Iron Law

**NO CODE WITHOUT A FAILING TEST FIRST.**

If you wrote production code before writing a failing test for it: **delete it**. Not "keep as reference." Not "adapt it." DELETE means DELETE. Write the test first, watch it fail, then write the code.

No exceptions. No "just this once." No "it's too simple to need a test." No "I'll add tests after."

### Rationalization Table

When you catch yourself thinking any of these, STOP and follow the counter:

| Excuse | Counter |
|--------|---------|
| "This is too simple to need a test" | Simple code has simple tests. Write it in 30 seconds. |
| "I'll add tests right after" | You won't. And if you do, you'll write tests that pass your code, not tests that verify behavior. |
| "I already know this works" | Then proving it with a test costs nothing. Do it. |
| "Testing this would be too complex" | That means your design is too coupled. Redesign, then test. |
| "It's just a config/setup file" | If it can break the system, it needs a test. If it can't, it's not a task. |
| "I need to see the shape of the code first" | Write the test to define the shape. That IS the design step. |
| "The test framework isn't set up yet" | Setting up the test framework IS your first task. |
| "This is a refactor, behavior doesn't change" | Then existing tests cover it. Run them. If they don't exist, write them first. |
| "I'm blocked on dependencies" | Mock them. Test your logic in isolation. |
| "The user didn't ask for tests" | SpecDev requires TDD. The user chose this workflow. |
| "I'll write better tests once I understand the code" | You understand the code by writing tests for it. |
| "This is exploratory / spike code" | Spikes go in research.md, not in source files. |

---

## Red-Green-Refactor Cycle

Every task in `implementation.md` IS a Red-Green-Refactor unit. Not "implement then test" — each task cycles through all three phases.

### Phase 1: RED — Write a Failing Test

```
GATE: Before writing ANY production code for this task:
  1. Write a test that describes the expected behavior
  2. Run the test
  3. VERIFY it fails for the RIGHT reason (missing function, wrong return value — not import error or typo)
  IF test passes → you misunderstand the current state. Investigate.
  IF test fails for wrong reason → fix test setup, not production code.
  ONLY proceed to GREEN when test fails for the correct reason.
```

**Good Example:**
```
# T002: Implement validate_email
# RED: Write test first
def test_validate_email_rejects_missing_at():
    assert validate_email("userexample.com") == False
# Run → NameError: validate_email not defined ← correct failure
# Now proceed to GREEN
```

**Bad Example:**
```
# T002: Implement validate_email
# Wrote validate_email() function first
# Then wrote test that calls it
# Test passes immediately ← you tested nothing
```

### Phase 2: GREEN — Make the Test Pass

```
GATE: Write the MINIMUM code to make the failing test pass.
  1. Implement only what the test demands — no more
  2. Run the test
  3. VERIFY it passes
  4. Run ALL existing tests
  IF new test passes but old tests break → fix without breaking new test.
  IF new test still fails → debug the implementation, not the test.
  ONLY proceed to REFACTOR when ALL tests pass.
```

**Good Example:**
```
# GREEN: Minimum code to pass
def validate_email(email):
    return "@" in email  # Just enough for this test
# Run → test passes, all other tests pass
```

**Bad Example:**
```
# GREEN: Wrote full RFC-compliant email validator
# with DNS lookup, internationalization support,
# and custom error messages — for a test that only
# checks for "@" presence
```

### Phase 3: REFACTOR — Clean Up

```
GATE: Only refactor when all tests are green.
  1. Improve code structure, naming, duplication
  2. DO NOT add new behavior (that requires a new RED phase)
  3. Run ALL tests after each change
  IF any test fails → undo last change, try different refactor.
  ONLY mark task complete when all tests pass on clean code.
```

---

## Task Structure

### Task Format
Each task in `implementation.md`:
- **Task ID**: T001, T002, etc.
- **Action**: What behavior to implement (framed as what the test will verify)
- **File**: Source file to create/modify
- **Test File**: Test file to create/modify
- **Scaffolding**: Which scaffold to reference
- **Dependencies**: Which tasks must complete first

### Task Ordering (TDD-First)
```
1. T001: Setup (test framework, project structure)
2. T002: First behavior — RED test → GREEN code → REFACTOR
3. T003: Next behavior — RED test → GREEN code → REFACTOR
4. ...repeat per behavior slice...
N. Final: Integration / examples (if needed)
```

Tests and implementation are interleaved PER TASK, not separated into "implement all" then "test all."

**Good Task Ordering:**
```
T001: Setup project structure and test framework
T002: validate_email rejects missing @ → test + impl
T003: validate_email rejects empty string → test + impl
T004: validate_email accepts valid format → test + impl
T005: Create usage example
```

**Bad Task Ordering:**
```
T001: Setup project structure
T002: Implement validate_email (all logic)
T003: Write all tests ← TOO LATE
T004: Create usage example
```

### Parallelizable Tasks
Mark with `[P]` if tasks modify different files and have no dependency overlap:
```
T005: [P] Implement user model (test + impl)
T006: [P] Implement post model (test + impl)
```

### Save Tasks
Write to `.specdev/assignments/#####_type_name/implementation.md`

---

## Subagent Isolation — Controller/Worker Model

When the main agent dispatches subagents for task execution:

```
GATE: Subagent dispatch protocol
  1. Main agent reads plan.md ONCE, fully understands scope
  2. For each task, main agent extracts:
     - Full task description (copy text, don't reference)
     - Relevant scaffold content (copy text, don't reference)
     - Relevant codestyle rules (copy text, don't reference)
  3. Dispatch a FRESH subagent per task with:
     - All context embedded in the prompt (subagent NEVER reads plan files)
     - Clear success criteria
     - File paths to create/modify
  4. Subagent asks ALL clarifying questions BEFORE writing any code
  IF subagent needs info not in its prompt → surface to main agent, don't guess.
  IF task is ambiguous → ask before working, not after.
```

**Why**: Subagents that read plan files accumulate stale context and make cross-task assumptions. Curated context keeps each task isolated and focused.

---

## Red Flags Checklist

STOP and reassess if you observe any of these:

- [ ] Writing production code with no test file open
- [ ] Test file created after production code is "done"
- [ ] All tests pass on first run (tests may not be testing anything real)
- [ ] Test only checks that function doesn't throw (not behavior)
- [ ] "Implement X" task has no corresponding test file
- [ ] Subagent is reading plan.md or other tasks' scaffolding
- [ ] Tasks ordered as "all implementation" then "all testing"
- [ ] GREEN phase code is significantly more than what the test requires
- [ ] Refactoring while tests are red
- [ ] Skipping RED because "this is obvious"

---

## Handling Issues

**Task fails Gate 2:** Fix → re-validate → don't proceed until passing.

**Task too large:** Split into subtasks (T005a, T005b), each a full TDD cycle.

**Scaffolding wrong:** Stop → fix scaffolding → get user approval (Gate 1 again) → resume.

**Blocked task:** Document blocker in implementation.md → move to next independent task.

---

## Final Validation

After all tasks complete:
1. Gates 3–4: Spec compliance review, then code quality review (see validation_guide.md)
2. Gate 5: Documentation and project scaffolding updates
3. Mark assignment complete in assignment_progress.md
