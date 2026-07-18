# Task Result: Prompt Utility

## Status: Complete

## Files Created
- `src/utils/prompt.js` — ~120 lines, 6 exported functions

## Notes
- Each function creates and closes its own readline interface to avoid state leaks
- `presentSuggestion()` returns null on reject (clean pattern for callers to filter)
- Multi-line input terminates on empty line
