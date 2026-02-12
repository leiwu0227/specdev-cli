---
name: knowledge-capture-project
description: Distill project-specific learnings from completed assignments
---

# Knowledge Capture — Project

## Contract

- **Input:** A completed assignment (all gates passed)
- **Process:** Scan assignment → extract learnings → categorize → write to knowledge vault
- **Output:** Entries in the appropriate `knowledge/` branches
- **Next skill:** knowledge-capture-specdev

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/scan-assignment.sh` | Scan an assignment and summarize its content | At the start, to understand what was done |

## Process

### Phase 1: Scan

1. Run `scripts/scan-assignment.sh <assignment-path>`
2. Read the output — it summarizes: goal, approach, key decisions, tasks completed, review findings
3. Use this as the basis for extracting learnings

### Phase 2: Extract Learnings

From the scan output, identify learnings in these categories:

- **What patterns were used?** (code patterns, architecture decisions)
- **What problems were solved?** (debugging insights, workarounds)
- **What conventions were established?** (naming, file structure)
- **What domain knowledge was gained?** (business rules, constraints)

### Phase 3: Categorize

Place each learning in the appropriate knowledge branch:

| Branch | What goes here |
|--------|---------------|
| `knowledge/codestyle/` | Code conventions, formatting rules, naming patterns |
| `knowledge/architecture/` | Architecture decisions, component relationships, data flow |
| `knowledge/domain/` | Business rules, domain concepts, constraints |
| `knowledge/workflow/` | Process improvements, tool usage, workflow patterns |

### Phase 4: Write

For each learning:

1. Create or update the appropriate knowledge file
2. Use clear, concise language — future agents will read this
3. Include the source assignment for traceability
4. Format as actionable guidance, not narrative

Template:
```markdown
## [Learning Title]

**Source:** [assignment name]
**Date:** [YYYY-MM-DD]

[Concise description of the learning]

**Applies when:** [When to use this knowledge]
**Example:** [Brief example if helpful]
```

### Phase 5: Review

Before committing:

1. Re-read each entry — is it accurate?
2. Check for contradictions with existing knowledge
3. If an existing entry is outdated, update it rather than adding a duplicate
4. Commit the knowledge entries

## Red Flags

- Writing vague learnings ("the code was complex") — be specific and actionable
- Skipping categories — check all four branches for relevant learnings
- Duplicating existing knowledge — check what exists before writing
- Writing narrative instead of guidance — future agents need actionable advice

## Integration

- **Before this skill:** verification (confirms the assignment is complete)
- **After this skill:** knowledge-capture-specdev (meta-observations about the workflow)
- **Uses:** The knowledge vault at `.specdev/knowledge/`
