# Subagent-Driven Development

Execute plan by dispatching a fresh subagent per task, with two-stage review after each: spec compliance first, then code quality.

**Core principle:** Fresh subagent per task + two-stage review = high quality, no context pollution.

## When to Use

- You have an implementation plan with discrete tasks
- Tasks are mostly independent (not tightly coupled)
- You want consistent quality gates per task

## The Process

```
1. Read plan.md ONCE, extract ALL tasks with full text
2. Note context for each task (where it fits, dependencies)

PER TASK:
  3. Dispatch implementer subagent (see Prompt Template A)
     - If subagent asks questions -> answer, re-dispatch
  4. Implementer implements, tests (TDD), commits, self-reviews, reports back
  5. Dispatch spec reviewer subagent (see Prompt Template B)
     - If FAIL -> implementer fixes -> re-dispatch spec reviewer
  6. Dispatch code quality reviewer subagent (see Prompt Template C)
     - If NOT READY -> implementer fixes -> re-dispatch quality reviewer
  7. Mark task complete

AFTER ALL TASKS:
  8. Dispatch final code quality reviewer for entire implementation
  9. Proceed to finalize
```

## Critical Rules

- **Copy full task text into subagent prompt.** Subagent NEVER reads plan files directly.
- **Copy relevant scaffold content** into prompt (don't reference file paths).
- **Fresh subagent per task.** No reuse across tasks.
- **Questions before code.** Subagent asks ALL clarifying questions before writing code.
- **Spec compliance before quality.** Never start code quality review until spec review passes.
- **Review loops until approved.** Reviewer found issues = implementer fixes = reviewer re-reviews. No skipping.

---

## Prompt Template A: Implementer Subagent

Use when dispatching an implementer subagent for a single task.

```
You are implementing Task [N]: [task name]

## Task Description

[FULL TEXT of task from plan - paste here, don't reference file]

## Context

[Scene-setting: where this fits in the overall plan, dependencies on prior tasks,
architectural context, relevant scaffold content]

## Before You Begin

If you have questions about:
- The requirements or acceptance criteria
- The approach or implementation strategy
- Dependencies or assumptions
- Anything unclear in the task description

**Ask them now.** Raise concerns before starting work.

## Your Job

Once clear on requirements:
1. Write a failing test for the behavior (RED)
2. Watch it fail for the right reason
3. Write minimal code to pass (GREEN)
4. Refactor if needed (REFACTOR)
5. Commit your work
6. Self-review (see below)
7. Report back

Work from: [directory]

**While you work:** If you encounter something unexpected or unclear, ask questions.
Don't guess or make assumptions.

## Before Reporting Back: Self-Review

Review your work with fresh eyes:

**Completeness:**
- Did I implement everything in the spec?
- Did I miss any requirements?
- Are there edge cases I didn't handle?

**Quality:**
- Is this my best work?
- Are names clear and accurate?
- Is the code clean and maintainable?

**Discipline:**
- Did I avoid overbuilding (YAGNI)?
- Did I only build what was requested?
- Did I follow existing patterns in the codebase?

**Testing:**
- Do tests verify behavior (not just mock behavior)?
- Did I follow TDD (test first, watch fail, minimal code)?
- Are tests comprehensive?

If you find issues during self-review, fix them before reporting.

## Report Format

When done, report:
- What you implemented
- What you tested and test results
- Files changed
- Self-review findings (if any)
- Any issues or concerns
```

---

## Prompt Template B: Spec Compliance Reviewer Subagent

Use after implementer reports back. Purpose: verify they built what was requested (nothing more, nothing less).

```
You are reviewing whether an implementation matches its specification.

## What Was Requested

[FULL TEXT of task requirements - paste here]

## What Implementer Claims They Built

[Paste implementer's report]

## CRITICAL: Do Not Trust the Report

The implementer's report may be incomplete, inaccurate, or optimistic.
You MUST verify everything independently.

**DO NOT:**
- Take their word for what they implemented
- Trust their claims about completeness
- Accept their interpretation of requirements

**DO:**
- Read the actual code they wrote
- Compare actual implementation to requirements line by line
- Check for missing pieces they claimed to implement
- Look for extra features they didn't mention

## Your Job

Read the implementation code and verify:

**Missing requirements:**
- Did they implement everything requested?
- Are there requirements they skipped or missed?
- Did they claim something works but didn't actually implement it?

**Extra/unneeded work:**
- Did they build things not requested?
- Did they over-engineer or add unnecessary features?

**Misunderstandings:**
- Did they interpret requirements differently than intended?
- Did they solve the wrong problem?

**Verify by reading code, not by trusting the report.**

## Output

- PASS (if everything matches after code inspection)
- FAIL with issues: [list specifically what's missing or extra, with file:line references]
```

---

## Prompt Template C: Code Quality Reviewer Subagent

Use after spec compliance review passes. Purpose: verify implementation is well-built.

```
You are reviewing code quality for a task implementation.

## What Was Implemented

[From implementer's report and spec reviewer confirmation]

## Files Changed

[List files or provide git diff range]

## Your Job

Review the implementation for:

**Code Quality:**
- Clean, readable, maintainable code
- Consistent naming and style
- No unnecessary complexity
- Follows existing codebase patterns

**Architecture:**
- Appropriate abstractions
- Good separation of concerns
- No tight coupling introduced

**Testing:**
- Tests actually verify behavior (not mocks)
- Edge cases and error paths covered
- Tests are clear and maintainable

**Requirements:**
- Implementation matches spec (confirmed by prior review)
- No over-engineering beyond requirements

## Output Format

**Strengths:** [what's done well]

**Issues:** (each with severity and file:line reference)
- CRITICAL: [blocks merge, must fix]
- IMPORTANT: [should fix before merge]
- MINOR: [nice to fix, not blocking]

**Verdict:** READY TO MERGE or NOT READY

If NOT READY, list what must be fixed.
```

---

## Red Flags

**Never:**
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementer subagents in parallel (conflicts)
- Make subagent read plan files (provide full text instead)
- Skip scene-setting context
- Ignore subagent questions
- Accept "close enough" on spec compliance
- Start code quality review before spec compliance passes
- Move to next task while either review has open issues

**If subagent asks questions:** Answer clearly and completely before letting them proceed.

**If reviewer finds issues:** Implementer fixes, reviewer re-reviews. Repeat until approved.

**If subagent fails task:** Dispatch fix subagent with specific instructions. Don't fix manually (context pollution).

---

## Skill Artifact

When invoked, log in `skills_invoked.md` with:
- Trigger: plan has 2+ independent tasks
- Artifact: task completion log in `implementation.md` showing implement/review/fix cycle per task
