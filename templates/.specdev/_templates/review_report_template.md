# Review Report

**Assignment:** [assignment_id] — [assignment_name]
**Gate:** [gate_3 / gate_4]
**Reviewer:** [agent / human]
**Date:** YYYY-MM-DD

---

## Pre-flight (verify-gates.sh)

```
[paste verify-gates.sh output here]
```

**Result:** PASS / FAIL

---

## Gate 3: Spec Compliance Review

> Skip this section if reviewing gate_4 only.

### Proposal/Plan Scope

[Summarize the approved scope from proposal.md and plan.md]

### Implementation Coverage

| Requirement | Covered? | Notes |
|---|---|---|
| [requirement from proposal] | Yes / No / Partial | [details] |

### Deviations

| File:Line | Expected | Actual | Severity |
|---|---|---|---|
| [location] | [what was planned] | [what was implemented] | CRITICAL / IMPORTANT / MINOR |

### Verdict

**PASS** / **FAIL**

[Justification]

---

## Gate 4: Code Quality Review

> Skip this section if reviewing gate_3 only.

### Findings

| # | File:Line | Severity | Issue | Impact | Suggested Fix |
|---|---|---|---|---|---|
| 1 | [location] | CRITICAL / IMPORTANT / MINOR | [description] | [impact] | [fix] |

### Summary

- CRITICAL: [count]
- IMPORTANT: [count]
- MINOR: [count]

### Verdict

**READY TO MERGE** / **NOT READY**

[Justification]

---

## Notes

[Additional observations, recommendations, or follow-up items]
