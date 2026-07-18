# Task Spec: Prompt Utility

## Objective
Create `src/utils/prompt.js` — thin wrapper around Node's built-in `readline` for interactive prompts. Used by both ponder commands.

## Requirements
- `ask(question)` — single-line text input
- `askChoice(prompt, options)` — numbered options, returns index
- `askYesNo(question)` — y/n prompt
- `askMultiLine(prompt)` — multi-line input, ends with empty line
- `presentSuggestion(suggestion)` — shows suggestion, offers accept/edit/reject
- `askCustomObservation()` — asks if user wants to add a custom entry

## Constraints
- No external dependencies (Node built-in readline only)
