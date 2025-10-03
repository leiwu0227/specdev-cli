# Guides Overview

This directory contains all guides for working with SpecDev assignments.

---

## Structure

### `/task/` - Repeatable Steps
Task guides cover specific, repeatable activities that apply across all assignment types:

- **planning_guide.md** - How to create detailed plans
- **scaffolding_guide.md** - How to write scaffolding documents
- **implementing_guide.md** - How to execute implementation tasks
- **validation_guide.md** - Quality gates (code validation)
- **documentation_guide.md** - How to update project documentation (finalize step)
- **research_guide.md** - How to investigate unfamiliar code (familiarization)
- **presentation_guide.md** - How to document findings (familiarization)

### `/workflow/` - Domain-Specific Sequencing
Workflow guides layer assignment-type-specific processes, combining task guides into complete workflows:

- **feature_workflow.md** - Building new capabilities
- **refactor_workflow.md** - Restructuring existing code
- **bugfix_workflow.md** - Diagnosing and fixing defects
- **familiarization_workflow.md** - Learning unfamiliar code areas

### Root Level - General Guidance
- **assignment_guide.md** - How to start and structure any assignment
- **codestyle_guide.md** - Coding philosophy and standards

---

## How to Use

1. **Starting an assignment?**
   - Read `assignment_guide.md` first
   - Check the relevant workflow guide for your assignment type

2. **Need help with a specific step?**
   - Jump directly to the task guide (planning, scaffolding, implementing, etc.)

3. **Writing code?**
   - Follow `codestyle_guide.md` principles

---

## Quick Reference

| Assignment Type | Workflow Guide | Key Task Guides Used |
|----------------|----------------|---------------------|
| Feature | feature_workflow.md | planning, scaffolding, implementing, validation, documentation |
| Refactor | refactor_workflow.md | planning, scaffolding, implementing, validation, documentation |
| Bugfix | bugfix_workflow.md | (planning optional), scaffolding, implementing, validation, documentation |
| Familiarization | familiarization_workflow.md | research, presentation, documentation |
