# Skill: Requesting Code Review

## Use when

- Entering validation Gates 3-4
- Requesting independent review from subagents

## Review packet

Provide reviewer with:

- Assignment goal summary
- Changed files list
- Proposal/plan excerpts relevant to changed behavior
- Test command outputs
- Known tradeoffs or unresolved concerns

## Required output format

- Verdict: `PASS` / `FAIL` (spec review) or `READY TO MERGE` / `NOT READY` (quality review)
- Findings grouped by severity: `CRITICAL`, `IMPORTANT`, `MINOR`
- Every finding includes `file:line`, impact, and proposed fix

## Deliverable

Write review packet and reviewer output into `validation_checklist.md`.
