---
name: review-agent
description: Phase-aware holistic reviewer — runs via specdev review in a separate session
type: core
phase: verify
input: Assignment folder with completed phase outputs
output: review/review-feedback.md
next: null
---

# Review Agent

## Contract

- **Input:** An assignment folder with completed phase outputs
- **Process:** Detect phase → read phase artifacts → holistic review → discuss findings with user
- **Output:** `review/review-feedback.md` with verdict and findings
- **Next:** User communicates findings to the main agent session (or approves)

## How to Launch

User runs `specdev review` in a separate Claude Code session. The command:

1. Detects the active assignment automatically
2. Determines which phase to review based on assignment state
3. Loads the review protocol for that phase
4. Starts an interactive review session with the user

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `prompts/breakdown-reviewer.md` | Review the breakdown plan holistically | After breakdown phase completes |
| `prompts/implementation-reviewer.md` | Review the full implementation holistically | After implementation phase completes |

## Review Protocol

### Brainstorm Review

Read `brainstorm/proposal.md` and `brainstorm/design.md`. Check:
- Is the goal clear and specific?
- Does the architecture make sense?
- Are there gaps in the design (missing error handling, unclear data flow)?
- Are the decisions well-reasoned?

### Breakdown Review

Use `prompts/breakdown-reviewer.md`. Check:
- Does the plan cover everything in the design?
- Are tasks ordered correctly (dependencies respected)?
- Is each task small enough (2-5 minutes)?
- Does every task have complete code, exact paths, exact commands?
- Are there missing tasks or unnecessary tasks?

### Implementation Review

Use `prompts/implementation-reviewer.md`. Check:
- Does the full implementation match the design?
- Do all tests pass?
- Are there integration issues between tasks?
- Is there scope drift (things built that weren't in the design)?
- Is test coverage adequate?

## Feedback Format

### review-feedback.md (written by review agent)

```markdown
# Review Feedback

**Phase:** breakdown
**Verdict:** approved / needs-changes
**Round:** 1
**Timestamp:** 2025-01-15T10:35:00

## Findings
- [list, or "None — approved"]
```

## Red Flags

- Nitpicking during holistic review — focus on macro issues, not style
- Approving without reading the actual files — always read the artifacts
- Skipping re-review after fixes — always verify fixes actually address findings

## Integration

- **Works with:** Main agent (brainstorming, breakdown, implementing skills)
- **Launched by:** User, via `specdev review` in a separate session
- **Note:** This is optional — automatic subagent reviews handle per-task review during implementation
