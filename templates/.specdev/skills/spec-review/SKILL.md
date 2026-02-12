---
name: spec-review
description: Does the implementation match the plan exactly?
---

# Spec Review

## Contract

- **Input:** A completed implementation + the plan it was based on
- **Process:** Line-by-line comparison of plan requirements vs actual implementation
- **Output:** PASS (all requirements met) or FAIL (with specific deviations listed)
- **Next skill:** code-review (if passed), fix deviations (if failed)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-assignment-context.sh` | Gather assignment context (proposal, plan, progress, decisions) | At the start, to load all relevant context |

## Process

### Phase 1: Load Context

1. Run `scripts/get-assignment-context.sh <assignment-path>`
2. Read the output — it summarizes the full assignment state
3. Identify: what was the plan? what was actually built?

### Phase 2: Read Scope

Extract every requirement from the plan:

1. List every file that should be created/modified
2. List every behavior that should be implemented
3. List every test that should exist
4. List every command that should work
5. Note any explicit constraints or decisions

### Phase 3: Read Implementation

Examine what was actually built:

1. Check every file listed in the plan — does it exist?
2. Read each file — does it match what the plan specified?
3. Run the tests — do they pass?
4. Check for behavior correctness, not just file existence

### Phase 4: Compare

For each requirement, categorize the result:

**Missing requirements** — Plan says X, but X is not implemented
- Severity: CRITICAL (blocks completion)
- Action: Must be implemented before passing

**Extra work** — Implementation includes Y, but plan never asked for Y
- Severity: WARNING (may indicate scope creep or misunderstanding)
- Action: Evaluate if extra work is beneficial or harmful

**Misinterpretations** — Plan says X, implementation does something similar but different
- Severity: CRITICAL or WARNING depending on impact
- Action: Must be corrected to match plan intent

### Phase 5: Verdict

**PASS** — All plan requirements are met. Extra work may exist but doesn't harm anything.

**FAIL** — One or more requirements are missing or misinterpreted. List every deviation.

Report format:

```
## Spec Review: [Assignment Name]

**Verdict:** PASS / FAIL

### Missing Requirements
- [list or "None"]

### Extra Work
- [list or "None"]

### Misinterpretations
- [list or "None"]

### Notes
- [any observations]
```

## Red Flags

- Accepting "close enough" — the plan is specific for a reason, match it exactly
- Skipping file-by-file comparison — every file in the plan must be checked
- Trusting the implementer's summary — read the actual code, not their description
- Ignoring extra work — scope creep signals misunderstanding
- Not running the tests — "tests exist" is not the same as "tests pass"

## Integration

- **Before this skill:** executing or subagent-dispatch (produces the implementation)
- **After this skill:** code-review (quality review of passed implementations)
- **Critical rule:** Spec review comes BEFORE code quality review — no point reviewing quality of wrong code
