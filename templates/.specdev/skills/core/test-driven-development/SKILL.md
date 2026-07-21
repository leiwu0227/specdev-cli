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
  executable behavior) — TDD does not apply; use the lightweight verification
  authorized by the Assignment contract and recorded in its plan.

## Contract

- **Input:** A task to implement (from a plan or assignment)
- **Process:** RED → GREEN → REFACTOR for every change in scope above
- **Output:** Tested code with compact evidence of the RED-GREEN-REFACTOR cycle
- **Next skill:** verification-before-completion

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh` | Run a project test command (scoped or full) and return structured pass/fail JSON | After writing a test (RED), after writing code (GREEN), after refactoring |

The script accepts an optional second argument: `verify-tests.sh <project-root> [test-command]`. **Always provide the scoped command authorized by the Assignment contract and repository policy.** Omitting the command auto-detects a full suite and is allowed only when that full suite was explicitly authorized.

Scoping examples:

| Stack | Per-task scoped command | Full-suite command (only when authorized) |
|-------|------------------------|----------------------------------------|
| Node (mocha / vitest / node:test) | `node --test tests/test-<feature>.js` or `npx vitest run tests/<feature>.test.ts` | `npm test` |
| Python (pytest) | `pytest tests/test_<feature>.py::test_<name> -x` | `pytest` |
| Rust (cargo) | `cargo test <feature>::<name>` | `cargo test` |
| Go | `go test ./<pkg> -run Test<Name>` | `go test ./...` |

If the plan does not name a scoped command for a task, infer one from the test file(s) created in that task's Step 1.

## Process

### Step 1: RED — Write the Failing Test

1. Write a test that describes the desired behavior
2. The test MUST be specific: one behavior, one assertion
3. Do NOT write any production code yet

### Step 2: Verify RED

1. Run `verify-tests.sh <project-root> "<scoped test command for this task's test file>"`
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

1. Run `verify-tests.sh <project-root> "<scoped test command>"`
2. Confirm the output shows `"passed": true`
3. If tests still fail — fix the implementation, do not modify the test

### Step 5: REFACTOR

1. Clean up the code you just wrote (if needed)
2. Remove duplication, improve naming, simplify logic
3. Run `verify-tests.sh <project-root> "<scoped test command>"` again
4. Confirm the scoped tests still pass — refactoring must not change behavior
5. If tests fail after refactoring, you changed behavior — undo and try again

### Step 6: Record progress

1. Update the Assignment's Task status and verification receipt.
2. Do not create a commit unless the approved contract explicitly delegates that authority.

### Step 7: End-of-Phase Verification

Once **all** tasks in the plan are complete, run the narrowest command that
proves the Assignment acceptance criteria and remains inside repository and
contract authority. Run a full suite at most once, and only when broad scope or
the approved contract requires it. Reuse a receipt for the same command on the
same revision.

## Red Flags

- Writing production code before the test — STOP, delete it, write the test first
- Test passes immediately on first run — the test is wrong or the behavior exists
- Skipping the verify step — always run verify-tests.sh, never assume
- Running the **full suite** without explicit need and authority — scope to the changed behavior by default
- Writing more code than needed to pass the test — minimal means minimal
- Modifying the test to make it pass — fix the code, not the test
- Refactoring without verifying — always run scoped tests after refactoring

## Integration

- **Before this skill:** planning or executing (provides the task to implement)
- **After this skill:** verification-before-completion (checks the authorized evidence envelope)
- **Always paired with:** systematic-debugging (when tests fail unexpectedly)
