# Project Notes Diff — Discussions + .current pointer
**Date:** 2026-03-12  |  **Assignment:** 00003_refactor_mandatory-assignment-flag

## Gaps Found
- big_picture.md still describes `resolveAssignmentPath(flags)` as "finds the latest or specified assignment" — this heuristic was removed. Should say it reads `.specdev/.current` pointer file.
- big_picture.md doesn't mention `focus.js` or `discuss.js` commands, or the `.current` pointer concept.
- big_picture.md doesn't mention the discussions system (`D####` IDs under `.specdev/discussions/`).
- Assignment IDs section doesn't mention the two creation paths (reserve-only vs `--type/--slug` automated).
- Reviewloop section doesn't mention discussion reviewloop or `SPECDEV_DISCUSSION` env var.

## No Changes Needed
- Tech stack description is accurate
- Architecture file tree is still correct (new files fit existing patterns)
- Conventions section is accurate
- Knowledge system description is current
