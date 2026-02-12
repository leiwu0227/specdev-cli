---
name: knowledge-capture-specdev
description: Meta-observations about the workflow itself — feed improvements upstream
---

# Knowledge Capture — SpecDev

## Contract

- **Input:** A completed assignment (after project knowledge capture)
- **Process:** Reflect on the workflow → identify improvements → write feedback → suggest changes
- **Output:** Entries in `knowledge/_workflow_feedback/`
- **Next skill:** none (terminal — this is the last step in the assignment lifecycle)

## Scripts

This skill has no scripts of its own. It references:

| Script | Source | When to run |
|--------|--------|-------------|
| `knowledge-capture-project/scripts/scan-assignment.sh` | knowledge-capture-project skill | To review what happened in the assignment |

## Process

### Phase 1: Reflect

Think about the workflow itself, not the project:

1. Run `knowledge-capture-project/scripts/scan-assignment.sh <assignment-path>` if not already done
2. Ask yourself:
   - Did the workflow help or hinder this assignment?
   - Were the right skills available?
   - Did any skill feel incomplete or missing?
   - Were the scripts useful? Any gaps?
   - Did the gate process work smoothly?

### Phase 2: Identify Improvements

Look for patterns across these categories:

**Skill improvements:**
- A skill needed a step that was missing
- A skill had an unnecessary step
- A skill's Red Flags section was missing a common mistake

**Script improvements:**
- A script needed a feature it didn't have
- A script's output format was inconvenient
- A script failed in an unexpected way

**New skills needed:**
- A situation arose with no matching skill
- An existing flat-file skill should be promoted to folder-based
- A common pattern deserves its own skill

**Process improvements:**
- The gate sequence was too strict or too loose
- Handoff between skills was unclear
- Documentation was missing or misleading

### Phase 3: Write

For each observation, write to `knowledge/_workflow_feedback/`:

```markdown
## [Observation Title]

**Source:** [assignment name]
**Date:** [YYYY-MM-DD]
**Category:** skill-improvement | script-improvement | new-skill | process-improvement

[Description of the observation]

**Suggested change:** [What should be different]
**Impact:** [What would improve if this change were made]
```

### Phase 4: Suggest

If you identified concrete improvements:

1. For skill improvements: note the specific skill and section to update
2. For script improvements: note the script and what to change
3. For new skills: sketch a brief SKILL.md outline
4. For process improvements: describe the change to the workflow

These suggestions feed back into the specdev system itself — they make future assignments smoother.

## Red Flags

- Skipping this step — meta-observations are how the system improves
- Being too vague ("the process was fine") — be specific about what worked and what didn't
- Only noting problems — also capture what worked well
- Not suggesting concrete changes — observations without suggestions don't lead to improvement

## Integration

- **Before this skill:** knowledge-capture-project (captures project-specific learnings first)
- **After this skill:** none — this is the terminal step
- **Feeds into:** The specdev system itself — improvements here make future work better
