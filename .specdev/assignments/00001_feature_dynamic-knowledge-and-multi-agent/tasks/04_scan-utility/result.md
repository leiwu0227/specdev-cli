# Task Result: Scan Utility

## Status: Complete

## Files Created
- `src/utils/scan.js` — ~170 lines

## Public API
- `scanAssignments(specdevPath)` — returns array of assignment summaries with phases, skippedPhases, context, tasks, scaffold info
- `readKnowledgeBranch(knowledgePath, branch)` — reads all .md files from a knowledge branch

## Internal Functions
- `scanSingleAssignment()` — scans one assignment directory
- `parseAssignmentName()` — extracts id/type/label from directory name
- `detectSkippedPhases()` — walks phases backward to find gaps
- `scanContext()` — reads decisions, progress, counts messages
- `scanTasks()` — reads task directories for spec/result/scratch
