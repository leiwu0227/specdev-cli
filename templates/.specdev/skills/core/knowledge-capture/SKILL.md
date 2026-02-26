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
- **Process:** Compare learnings against project_notes → compare flow against specdev workflow → write two files
- **Output:** Two files in the assignment's `capture/` directory
- **Next:** None — this is the final phase

## Process

### Step 1: Project Notes Diff

Compare what you learned during this assignment against the existing project notes:

1. Read `project_notes/big_picture.md` and `project_notes/feature_descriptions.md`
2. What did you learn about the project that these files don't capture?
3. Write findings to `capture/project-notes-diff.md`:

```markdown
# Project Notes Diff — [Assignment Name]

**Date:** YYYY-MM-DD
**Assignment:** [id and name]

## Gaps Found
- [What's missing or outdated in project_notes, with specific suggestions]

## No Changes Needed
- [Aspects that are already well-documented]
```

**Do NOT update the project_notes files.** The user decides whether to apply.

### Step 2: Workflow Diff

Compare how the workflow actually went against the specdev process:

1. Reflect on each phase: brainstorm, breakdown, implement, review
2. What worked well? What was friction?
3. Write findings to `capture/workflow-diff.md`:

```markdown
# Workflow Diff — [Assignment Name]

**Date:** YYYY-MM-DD
**Assignment:** [id and name]

## What Worked
- [Specific observations]

## What Didn't
- [Friction points, gaps, suggestions]
```

## Red Flags

- Updating project_notes files directly — write diffs only, user decides
- Being too vague — "it went fine" is not useful. Be specific.
- Skipping this phase — even small assignments produce learnings

## Integration

- **Before this skill:** implementing (produces the work to reflect on)
- **After this skill:** None — terminal phase
