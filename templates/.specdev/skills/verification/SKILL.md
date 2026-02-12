---
name: verification
description: Deterministic gate checks — evidence before claims, always
---

# Verification

## Contract

- **Input:** A completion claim — someone says "this task/assignment is done"
- **Process:** Run all gate conditions → collect evidence → evaluate pass/fail per gate
- **Output:** Evidence table with pass/fail per gate, overall verdict
- **Next skill:** knowledge-capture-project (if passed), fix issues (if failed)

## Iron Law

> **NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

Every claim must be backed by evidence from a verification run. Stale evidence (from before the latest change) does not count.

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/verify-gates.sh` | Run all gate checks for an assignment | Before any completion claim |

## Process

### Phase 1: Identify Claims

1. What is being claimed as complete? (a task, a gate, the full assignment)
2. What evidence is required to support this claim?
3. When was the last change made? Evidence must be from AFTER this point.

### Phase 2: Run Gate Checks

1. Run `scripts/verify-gates.sh <assignment-path> <project-root>`
2. The script checks each gate:
   - **Gate 0:** Proposal and plan exist
   - **Gate 1:** Scaffold (if applicable)
   - **Gate 2:** Tests pass
   - **Gate 3:** Review passed
   - **Gate 4:** Final review
3. Collect the JSON output

### Phase 3: Evaluate Evidence

For each gate in the output:

1. Did it pass? Check the `passed` field
2. What checks were run? Review the `checks` array
3. Are the checks sufficient? A gate passing with weak checks is not a real pass
4. Is the evidence fresh? Timestamps should be after the latest change

### Phase 4: Report

Present the evidence table:

| Gate | Status | Evidence |
|------|--------|----------|
| Gate 0: Proposal + Plan | PASS/FAIL | What was found |
| Gate 1: Scaffold | PASS/FAIL/N/A | What was found |
| Gate 2: Tests | PASS/FAIL | Test output summary |
| Gate 3: Review | PASS/FAIL | Review status |
| Gate 4: Final | PASS/FAIL | Final review status |

**Overall verdict:** PASS (all gates green) or FAIL (list failing gates)

## Red Flags

- Accepting completion claims without running verify-gates.sh — always run it
- Using stale evidence — evidence must be from after the latest change
- Skipping failed gates — every gate must pass, no exceptions
- Trusting verbal claims — "I tested it" is not evidence, run the script
- Marking complete when tests fail — test failures mean it's not done

## Integration

- **Before this skill:** executing or code-review (produces the work to verify)
- **After this skill:** knowledge-capture-project (if passed), fix + re-verify (if failed)
- **Always active:** This skill's principles apply to EVERY completion claim in EVERY skill
