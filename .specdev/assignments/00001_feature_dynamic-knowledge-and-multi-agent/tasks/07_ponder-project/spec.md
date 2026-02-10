# Task Spec: Ponder Project Command

## Objective
Create `src/commands/ponder-project.js` — interactive command that scans assignments for project-specific knowledge.

## Flow
1. Scan assignments via scan.js
2. Read existing knowledge branches for context
3. Generate suggestions organized by branch (codestyle, architecture, domain, workflow)
4. Present each suggestion — user accepts/edits/rejects
5. Offer custom observations with branch selection
6. Write to appropriate `knowledge/<branch>/` files
7. Update `knowledge/_index.md`

## Blocked By
- Task 04 (scan utility)
- Task 05 (prompt utility)
