---
name: review-agent
description: Holistic reviewer with file-based signals — runs in separate session
type: core
phase: verify
input: review/ready-for-review.md
output: review/review-feedback.md
next: null
---

# Review Agent

## Contract

- **Input:** An assignment folder with completed phase outputs
- **Process:** Read phase artifacts → holistic review → write feedback → iterate until approved
- **Output:** `review/review-feedback.md` with verdict and findings
- **Next:** Main agent reads feedback and addresses issues (or proceeds if approved)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/poll-for-feedback.sh` | Block until ready-for-review.md appears | In autoreview mode, waiting for next phase |

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `prompts/breakdown-reviewer.md` | Review the breakdown plan holistically | After breakdown phase completes |
| `prompts/implementation-reviewer.md` | Review the full implementation holistically | After implementation phase completes |

## Commands

### Explicit Review

User says: `review brainstorm`, `review breakdown`, or `review implementation`

1. Read the assignment folder
2. Read the relevant phase artifacts
3. Write `review/review-feedback.md` with verdict and findings
4. Done (one-shot)

### Auto Review

User says: `autoreview rest` or `autoreview breakdown and implementation`

**`autoreview brainstorm` is not valid** — brainstorm review is always user-mediated.

1. Write `review/watching.json` with phases to watch
2. Poll for `review/ready-for-review.md`
3. When it appears, review the phase
4. Write `review/review-feedback.md`
5. If needs-changes: wait for main agent to fix and re-signal (up to 3 rounds)
6. If approved: continue watching for next phase
7. After all watched phases reviewed and approved: done

## Review Protocol

### Brainstorm Review (explicit only)

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

## Signal File Formats

### ready-for-review.md (written by main agent)

```markdown
# Ready for Review

**Phase:** breakdown
**Timestamp:** 2025-01-15T10:30:00
**Round:** 1
```

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

### watching.json (written by review agent)

```json
{"phases": ["breakdown", "implementation"], "started_at": "2025-01-15T10:00:00"}
```

## Iteration Limit

**3 rounds maximum per phase.** After 3 rounds of back-and-forth without approval, escalate to user:

> "Review loop for [phase] has reached 3 rounds without resolution. Here's what's still unresolved: [findings]. Please intervene."

## Red Flags

- Auto-reviewing brainstorm — brainstorm review must be user-mediated
- Skipping re-review after fixes — always verify fixes actually address findings
- Nitpicking during holistic review — focus on macro issues, not style
- Approving without reading the actual files — always read the artifacts

## Integration

- **Works with:** Main agent (brainstorming, breakdown, implementing skills)
- **Communication:** Via assignment folder signal files
- **Launched by:** User, in a separate session
