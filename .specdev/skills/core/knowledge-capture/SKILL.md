---
name: knowledge-capture
description: Distill learnings into knowledge branches after assignment completion
type: core
phase: capture
input: Completed assignment
output: Knowledge diff files, updated project_notes, knowledge branches
next: null
---

# Knowledge Capture

## Contract

- **Input:** A completed, verified assignment
- **Process:** Write capture diffs → update big_picture → update catalogs → run distill → finalize
- **Output:** `capture/` diffs, updated `project_notes/`, knowledge branches updated, assignment marked done
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

### Step 3: Update Big Picture

1. Read `project_notes/big_picture.md`
2. Update it with new information from this assignment:
   - Add new systems or components that were built
   - Revise descriptions that are now outdated
   - Remove things that no longer exist
3. **Keep it lean — under 2000 words.** Architecture-level facts only, no implementation details.
4. If the file is already near the limit, replace outdated content rather than appending.

### Step 4: Update Catalogs

1. Add an entry to `project_notes/feature_descriptions.md`:
   - Feature/Refactor: `### [Name]` with Assignment, Completed, Description (1-2 sentences), Key files
   - Familiarization: `### [System]` with Assignment, Completed, Summary (1-2 sentences), Key insights
   - Keep entries brief — this is a catalog, not detailed documentation
2. Mark assignment as DONE in `project_notes/assignment_progress.md`

### Step 5: Run Distill (hard requirement)

1. Run `specdev distill --assignment=<name>`
2. Read the JSON output — it contains:
   - Your capture diffs (for reference)
   - Existing knowledge file listings per branch
   - `big_picture_word_count` and `big_picture_word_limit` (verify you're under limit)
   - Heuristic suggestions (cross-assignment patterns)
3. Write synthesized observations to `knowledge/` branches as appropriate:
   - `knowledge/codestyle/` — naming conventions, formatting patterns, code style decisions
   - `knowledge/architecture/` — system design, component relationships, key decisions
   - `knowledge/domain/` — domain concepts, business logic patterns
   - `knowledge/workflow/` — process patterns, tool usage observations
4. Write workflow observations to `knowledge/_workflow_feedback/` as appropriate
5. If no new observations to write, that's OK — not every assignment produces reusable knowledge

### Step 6: Finalize (hard requirement)

1. Run `specdev distill done <assignment-name>`
2. This validates:
   - `big_picture.md` is under 2000 words
   - Assignment name appears in `feature_descriptions.md`
3. If validation fails: fix the issue and re-run `specdev distill done`
4. On success: assignment is marked as processed and complete

## Red Flags

- Being too vague — "it went fine" is not useful. Be specific.
- Skipping this phase — even small assignments produce learnings
- Skipping the distill step — every assignment must run `specdev distill` and `specdev distill done`
- Bloating `big_picture.md` — if near the word limit, replace outdated content instead of appending

## Integration

- **Before this skill:** implementing (produces the work to reflect on)
- **After this skill:** None — terminal phase
