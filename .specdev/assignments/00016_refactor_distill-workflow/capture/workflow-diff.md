# Workflow Diff - Structured Workflow Feedback Notes
**Date:** 2026-05-10  |  **Assignment:** 00016_refactor_distill-workflow

## What Worked
- Brainstorm review caught the important source-of-truth boundary before implementation: product changes belong in `templates/.specdev/`, tests, and docs rather than installed runtime `.specdev/` workflow files.
- The implementation was small enough for inline execution with clear TDD checks against `specdev init`, `specdev update`, and `specdev distill`.
- The implementation reviewer correctly ignored unrelated dirty reviewloop files and reviewed the committed assignment 00016 diff against the design.

## What Didn't
- The full `npm test` run exceeded the 240-second timeout before completion; rerunning the remaining suites found an existing `test-hook.js` implementation-phase expectation failure unrelated to the touched files.
- The local installed `.specdev/skills/core/knowledge-capture/SKILL.md` is intentionally not updated by product-source changes, so knowledge capture for this assignment still used the older installed guidance until a future `specdev update`.
