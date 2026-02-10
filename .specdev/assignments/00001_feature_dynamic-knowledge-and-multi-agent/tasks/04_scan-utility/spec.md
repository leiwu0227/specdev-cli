# Task Spec: Scan Utility

## Objective
Create `src/utils/scan.js` for scanning `.specdev/assignments/` directories. Used by both ponder commands.

## Requirements
- Find all assignment directories
- Parse assignment names (id, type, label)
- Detect which workflow phases exist per assignment
- Detect skipped phases (later phase exists without earlier one)
- Read context/ (decisions, progress, message count)
- Read tasks/ (spec, result, scratch existence)
- Export `readKnowledgeBranch()` for reading existing knowledge
