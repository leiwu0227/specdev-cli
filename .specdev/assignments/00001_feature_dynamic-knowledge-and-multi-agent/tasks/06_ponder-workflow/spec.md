# Task Spec: Ponder Workflow Command

## Objective
Create `src/commands/ponder-workflow.js` — interactive command that scans assignments for workflow-level observations.

## Flow
1. Scan assignments via scan.js
2. Generate rule-based suggestions (skipped phases, missing context, inconsistent decomposition, high message volume, missing scaffolds)
3. Present each suggestion — user accepts/edits/rejects
4. Offer custom observations
5. Write accepted items to `knowledge/_workflow_feedback/` as timestamped markdown

## Blocked By
- Task 04 (scan utility)
- Task 05 (prompt utility)
