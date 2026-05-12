---
name: test-driven-development
description: RED-GREEN-REFACTOR for full-mode tasks and behavior-changing standard-mode tasks
type: core
---

# Test-Driven Development

## Applies When

- A plan task declares `Mode: full` — strict RED → GREEN → REFACTOR is mandatory.
- A plan task declares `Mode: standard` AND introduces or changes behavior
  (new function, new branch, fixed bug) — test-first is mandatory.
- A plan task declares `Mode: lightweight` (trivial scaffold/config with no
  executable behavior) — TDD does not apply; the lightweight verification
  steps in `implementing/SKILL.md` govern.

## Contract

- **Input:** A task to implement (from a plan or assignment)
- **Process:** RED → GREEN → REFACTOR for every change in scope above
- **Output:** Tested, committed code with evidence of the RED-GREEN-REFACTOR cycle
- **Next skill:** verification-before-completion

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh` | Run the project's test suite and return structured results | After writing a test (RED), after writing code (GREEN), after refactoring |

## Process

### Step 1: RED — Write the Failing Test

1. Write a test that describes the desired behavior
2. The test MUST be specific: one behavior, one assertion
3. Do NOT write any production code yet

### Step 2: Verify RED

1. Run `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh <project-root> [test-command]`
2. Confirm the output shows `"passed": false`
3. If the test passes immediately — STOP. Your test is wrong:
   - Either the behavior already exists (check the codebase)
   - Or the test doesn't actually test what you think it does
4. Read the failure message — it should describe the missing behavior

### Step 3: GREEN — Write Minimal Code

1. Write the MINIMUM code to make the test pass
2. Do not add anything extra — no optimization, no edge cases, no cleanup
3. If the plan specifies exact code, use it
4. The goal is: test passes, nothing more

### Step 4: Verify GREEN

1. Run `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh <project-root> [test-command]`
2. Confirm the output shows `"passed": true`
3. If tests still fail — fix the implementation, do not modify the test
4. ALL tests must pass, not just the new one

### Step 5: REFACTOR

1. Clean up the code you just wrote (if needed)
2. Remove duplication, improve naming, simplify logic
3. Run `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh <project-root>` again
4. Confirm all tests still pass — refactoring must not change behavior
5. If tests fail after refactoring, you changed behavior — undo and try again

### Step 6: Commit

1. Commit the test + implementation together
2. The commit message should describe the behavior, not the implementation

## Red Flags

- Writing production code before the test — STOP, delete it, write the test first
- Test passes immediately on first run — the test is wrong or the behavior exists
- Skipping the verify step — always run verify-tests.sh, never assume
- Writing more code than needed to pass the test — minimal means minimal
- Modifying the test to make it pass — fix the code, not the test
- Refactoring without verifying — always run tests after refactoring

## Integration

- **Before this skill:** planning or executing (provides the task to implement)
- **After this skill:** verification (confirms all work is complete)
- **Always paired with:** systematic-debugging (when tests fail unexpectedly)
