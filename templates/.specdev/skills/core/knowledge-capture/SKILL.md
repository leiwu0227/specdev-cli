---
name: knowledge-capture
description: Distill learnings into knowledge branches after assignment completion
type: core
phase: capture
input: Completed assignment
output: Knowledge diff files
next: null
---

# Knowledge Capture

## Contract

- **Input:** A completed, verified assignment
- **Process:** Compare learnings against project_notes → compare flow against specdev workflow → update catalogs → finalize
- **Output:** `capture/project-notes-diff.md` + `capture/workflow-diff.md`, catalogs updated, assignment marked done
- **Next:** None — this is the final phase

## Process

### Step 1: Project Notes Diff

1. Read `project_notes/big_picture.md` and `project_notes/feature_descriptions.md`
2. What did you learn that these files don't capture?
3. Write findings to `capture/project-notes-diff.md`:

```markdown
# Project Notes Diff — [Assignment Name]
**Date:** YYYY-MM-DD  |  **Assignment:** [id and name]

## Gaps Found
- [What's missing or outdated, with specific suggestions]

## No Changes Needed
- [Aspects already well-documented]
```

**Do NOT update `big_picture.md` directly.** Write diffs only — the user decides whether to apply.

### Step 2: Workflow Diff

1. Reflect on each phase: brainstorm, breakdown, implement, review
2. Write findings to `capture/workflow-diff.md`:

```markdown
# Workflow Diff — [Assignment Name]
**Date:** YYYY-MM-DD  |  **Assignment:** [id and name]

## What Worked
- [Specific observations]

## What Didn't
- [Friction points, gaps, suggestions]
```

### Step 3: Update Catalogs and Finalize

1. Add an entry to `project_notes/feature_descriptions.md`:
   - Feature/Refactor: `### [Name]` with Assignment, Completed, Description (1-2 sentences), Key files
   - Familiarization: `### [System]` with Assignment, Completed, Summary (1-2 sentences), Key insights
   - Keep entries brief — this is a catalog, not detailed documentation
2. Mark assignment as DONE in `project_notes/assignment_progress.md`
3. Distill any reusable learnings into `knowledge/` branches (codestyle, architecture, domain, workflow)

## Red Flags

- Updating `big_picture.md` directly — write diffs only, user decides whether to apply
- Being too vague — "it went fine" is not useful. Be specific.
- Skipping this phase — even small assignments produce learnings

## Integration

- **Before this skill:** implementing (produces the work to reflect on)
- **After this skill:** None — terminal phase
