# Research Guide

## Purpose
Guide coding agents through investigating unfamiliar code areas.

---

## Process

### 1. Start
- Read proposal.md to understand learning objectives
- Find entry points (main files, API endpoints)
- Skim code for big picture

### 2. Investigate
- Read code and follow function calls
- Run with debugger, test different inputs
- Write spike code to verify understanding

### 3. Document in research.md

**Template:**
```markdown
# Research: [Topic]

## Summary
[2-3 sentences]

## How it Works
- Component A: Role
- Component B: Role
- Data flow: Input → Process → Output

## Key Files
- path/file.py:123 - Does X
- path/other.py:456 - Handles Y

## Important Concepts
- Concept 1: Definition and why it matters
- Concept 2: Definition and why it matters

## Code Example
```language
// Example showing key behavior
```

## What I Tested
- Hypothesis: [What I thought] → Result: ✓ Confirmed / ✗ Wrong

## Open Questions
- What needs follow-up

## Next Steps
- [ ] Task 1
```

---

## Tips

- ✓ Fact (verified), ? Assumption (unverified), TODO Unknown
- Document as you go
- Include file:line references
- Ask for help if stuck > 2 hours

---

## Checklist

- [ ] research.md complete
- [ ] Facts verified
- [ ] File references include line numbers
- [ ] Open questions listed

---

**For a complete example, see:** `.specdev/_templates/assignment_examples/familiarization/`
