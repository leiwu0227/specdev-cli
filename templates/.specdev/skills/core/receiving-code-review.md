# Skill: Receiving Code Review

**Always-apply.** Read at assignment start, follow throughout.

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality at cited file:line
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

**NEVER:**
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Thanks for catching that!"
- Any expression of gratitude or flattery toward reviewer
- "Let me implement that now" (before verification)
- Agreeing without verification

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

**Why no gratitude:** Sycophantic responses signal performing compliance rather than evaluating feedback. Actions speak. Just fix it. The code itself shows you heard the feedback.

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

## When To Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Conflicts with user's architectural decisions

**How to push back:**
- Use technical reasoning, not defensiveness
- Reference working tests/code
- Involve user if architectural

## Acknowledging Correct Feedback

```
GOOD: "Fixed utils/validator.py:12 - added empty string guard"
GOOD: "Good catch - missing edge case. Fixed in tests/test_validator.py:34"
GOOD: [Just fix it and show the diff]

BAD: "You're absolutely right!"
BAD: "Thanks for catching that!"
BAD: ANY gratitude expression
```

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:
```
GOOD: "Verified and you're correct. My initial understanding was wrong because [reason]. Fixing."
BAD: Long apology or defending why you pushed back
```

State the correction factually and move on.

## Response Format

- `Fixed <file:line>: <change>`
- `Disagree <file:line>: <evidence>`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or just act |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer is right | Check if breaks things |
| Avoiding pushback | Technical correctness > comfort |
| Partial implementation | Clarify all items first |

## Deliverable

Append a feedback disposition section to `validation_checklist.md` with status for each finding.
