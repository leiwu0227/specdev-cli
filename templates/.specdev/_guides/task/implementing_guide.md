# Implementation Guide

**Reference Example**: `_templates/assignment_examples/feature/00000_feature_email-validator/implementation.md`

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

Thinking "skip TDD just this once"? Stop. That's rationalization.

---

## Red-Green-Refactor

Each task in `implementation.md` IS one Red-Green-Refactor cycle.

### RED - Write Failing Test

Write one minimal test showing what should happen.

<Good>
```
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
Clear name, tests real behavior, one thing
</Good>

<Bad>
```
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
Vague name, tests mock not code
</Bad>

**Requirements:**
- One behavior
- Clear name
- Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

Run the test. Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

### GREEN - Minimal Code

Write simplest code to pass the test.

<Good>
```
async function retryOperation(fn) {
  for (let i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e) { if (i === 2) throw e; }
  }
}
```
Just enough to pass
</Good>

<Bad>
```
async function retryOperation(fn, options = {
  maxRetries: 3,
  backoff: 'exponential',
  onRetry: null
}) { /* YAGNI */ }
```
Over-engineered for the test
</Bad>

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN - Watch It Pass

**MANDATORY.**

Run the test. Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

**Test fails?** Fix code, not test.

**Other tests fail?** Fix now.

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

---

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | One thing. "and" in name? Split it. | `test('validates email and domain and whitespace')` |
| **Clear** | Name describes behavior | `test('test1')` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc is not systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for existing code. |

---

## Why Order Matters

**"I'll write tests after to verify it works"**
Tests written after code pass immediately. Passing immediately proves nothing. You never saw it catch the bug.

**"I already manually tested all the edge cases"**
Manual testing is ad-hoc. No record of what you tested. Can't re-run when code changes.

**"Deleting X hours of work is wasteful"**
Sunk cost fallacy. The time is already gone. Keeping code you can't trust is technical debt.

**"TDD is dogmatic, being pragmatic means adapting"**
TDD IS pragmatic. Finds bugs before commit. Prevents regressions. Documents behavior. Enables refactoring.

**"Tests after achieve the same goals - it's spirit not ritual"**
No. Tests-after are biased by your implementation. You test what you built, not what's required. Tests-first force edge case discovery before implementing.

---

## Red Flags - STOP and Start Over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

---

## Task Format

Each task in `implementation.md`:

- Task ID (T001, T002, ...)
- Behavior objective (framed as what the test verifies)
- Source file(s)
- Test file(s)
- Scaffolding reference (if applicable)
- Dependencies
- Binary success condition

### Task Ordering

- Setup first (test framework, project structure)
- Behavior slices next (each = one Red-Green-Refactor cycle)
- Integration last (examples, end-to-end)

Tests and implementation interleaved PER TASK. Never "implement all then test all."

### Parallel Execution

When tasks are independent, invoke `.specdev/skills/core/parallel-worktrees.md`.

A task is parallel-safe only if:
- no overlapping file writes
- no shared schema/global config mutation
- no hidden runtime coupling
- independent test path

Record worktree mapping and merge order in `implementation.md`.

### Save Tasks

Write to `.specdev/assignments/#####_type_name/implementation.md`.

---

## Subagent Isolation - Controller/Worker Model

When dispatching subagents for task execution, invoke `.specdev/skills/core/subagent-driven-development.md`.

Key principles (full protocol and prompt templates in the skill):

- Main agent reads plan ONCE, extracts all tasks with full text
- Dispatch a FRESH subagent per task with all context copied into the prompt
- Subagent NEVER reads plan files directly
- Subagent asks ALL clarifying questions BEFORE writing code
- Two-stage review after each task: spec compliance first, then code quality
- Review loops until both reviewers approve before moving to next task

**Why**: Subagents that read plan files accumulate stale context and make cross-task assumptions. Curated context keeps each task isolated.

---

## Bugfix Note

If root cause is unclear, invoke `.specdev/skills/core/systematic-debugging.md` before implementing the fix.

---

## Gate 2 Checklist (per task)

- [ ] Test was written before production code
- [ ] Test failed for the right reason
- [ ] Minimum code was used to pass
- [ ] New and existing tests pass
- [ ] Code follows codestyle guide
- [ ] Signature/contract matches planned artifacts

---

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

---

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write wished-for API. Write assertion first. Ask the user. |
| Test too complicated | Design too complicated. Simplify interface. |
| Must mock everything | Code too coupled. Use dependency injection. |
| Test setup huge | Extract helpers. Still complex? Simplify design. |

---

## Completion Rule

Do not mark tasks complete without verification evidence.
Invoke `.specdev/skills/core/verification-before-completion.md`.
