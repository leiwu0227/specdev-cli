# Workflow Diff - Structured Skill Inspection
**Date:** 2026-05-07  |  **Assignment:** 00010_feature_structured-skill-inspection

## What Worked
- The Hermes research thread translated cleanly into a narrow SpecDev feature: progressive skill disclosure through an index plus targeted file reads.
- Claude reviewloop was useful at both brainstorm and implementation gates. It confirmed scope fit during brainstorm and verified all seven success criteria after implementation.
- Splitting implementation into JSON inventory first and guarded file viewing second produced small, independently tested commits.
- Running the full suite after task 2 caught cross-command safety by exercising skills install, remove, sync, update, reviewloop, and workflow tests.

## What Didn't
- `specdev checkpoint breakdown` does not exist even though the breakdown workflow talks about plan review. The handoff still worked by running `specdev implement`, but the available checkpoint phases are not obvious from the breakdown instructions.
- The first task commit included the breakdown plan and initial progress file because the assignment artifacts had not been committed before implementation. This is acceptable, but committing the breakdown artifact before task work would make task commits narrower.
- The implementation reviewer noted a minor flat-markdown skill edge case: viewing support files for flat `.md` skills uses the category directory as the base. It is read-only and accepted, but a future hardening pass could make flat skills view-only for their own markdown file.
