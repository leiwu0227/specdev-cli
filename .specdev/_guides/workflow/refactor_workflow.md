# Refactor Assignment Workflow

## Purpose
Guide coding agents through restructuring existing code without changing observable behavior.

---

## Step 1: Proposal

**Deliverable:** `proposal.md`
**Owner:** User
**Guide:** User creates this file

**Key content:** What code needs restructuring; why (performance, maintainability, tech debt); success criteria (behavior unchanged, tests pass); risks; baseline metrics (test coverage, performance benchmarks).

**Next:** Agent may suggest improvements (requires user approval); proceed to planning.

---

## Step 2: Plan

**Deliverable:** `plan.md`
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/planning_guide.md`

**Key content:** Current vs proposed architecture; safe iteration slices; rollback strategies; risk mitigation; files/modules to touch.

**Next:** User approval required before scaffolding.

---

## Step 3: Scaffolding

**Deliverable:** `scaffold/` directory with scaffolding documents
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/scaffolding_guide.md`

**Process:** Read approved plan.md; create one scaffold per modified file; show after structure (not before/after); include Description, Dependencies, Workflows, Examples, Pseudocode.

**Gate 1:** User must approve scaffolding before implementation.

---

## Step 4: Implementation

**Deliverable:** Refactored source code files
**Owner:** Agent implements
**Guide:** `.specdev/_guides/task/implementing_guide.md`

**Process:** Create implementation.md with incremental task list; implement each refactor task; **CRITICAL:** run existing tests after every meaningful change; apply Gate 2 validation per task (follows codestyle_guide.md; matches scaffolding; has docstrings; no syntax errors; all existing tests still pass).

**Next:** All tasks complete → move to validation.

---

## Step 5: Validation

**Deliverable:** Validated, tested refactored code with behavior parity
**Owner:** Agent validates
**Guide:** `.specdev/_guides/task/validation_guide.md`

**Gate 3 - Testing:** All existing tests pass (behavior parity confirmed); add regression tests if gaps discovered; verify baseline metrics maintained (performance, coverage).

**Gate 4 - Integration:** End-to-end system works as before refactor; no breaking changes to external interfaces; dependencies updated.

**Next:** User approves validation → move to finalize.

---

## Step 6: Finalize

**Deliverable:** Updated documentation
**Owner:** Agent finalizes
**Guide:** `.specdev/_guides/task/documentation_guide.md`

**Process:** Update feature_descriptions.md (add to "Architecture & Structure" section; describe what changed architecturally; point to scaffolding for new structure); update project_scaffolding/ with new architecture notes; document migration notes; update usage examples if API shifted; mark assignment DONE in assignment_progress.md.

**Final:** Assignment complete.

---

## Key Checkpoints

- ✅ Proposal includes baseline metrics
- ✅ Plan includes rollback strategy
- ✅ Scaffolding shows after structure (Gate 1)
- ✅ Tests run after each refactor step (Gate 2)
- ✅ Behavior parity confirmed (Gates 3-4)
- ✅ Documentation updated before DONE

---

## Refactor-Specific Tips

- **Keep scope pure** - Don't mix feature work with refactors
- **Fail gracefully** - Keep commits/tasks reversible
- **Run tests constantly** - After every meaningful change
- **Use adapters** - Temporary compatibility layers for large reorganizations
- **Document before/after** - Capture diagrams or tables in research.md
- **Track new work** - Note any new tech debt or TODOs created
- **Verify metrics** - Performance, coverage should match baseline
