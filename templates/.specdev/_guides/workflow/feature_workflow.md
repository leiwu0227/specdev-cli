# Feature Assignment Workflow

## Purpose
Guide coding agents through delivering a net-new feature with clear deliverables and approval gates at each step.

---

## Step 1: Proposal

**Deliverable:** `proposal.md`
**Owner:** User
**Guide:** User creates this file

**Key content:** What the feature does; why it's needed; success criteria; constraints.

**Next:** Agent may suggest improvements (requires user approval); proceed to planning.

---

## Step 2: Plan

**Deliverable:** `plan.md`
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/planning_guide.md`

**Key content:** Dependencies analysis; implementation approach; file/module breakdown; potential issues.

**Next:** User approval required before scaffolding.

---

## Step 3: Scaffolding

**Deliverable:** `scaffold/` directory with scaffolding documents
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/scaffolding_guide.md`

**Process:** Read approved plan.md; create one scaffold per source file; include Description, Dependencies, Workflows, Examples, Pseudocode.

**Gate 1:** User must approve scaffolding before implementation.

---

## Step 4: Implementation

**Deliverable:** Actual source code files
**Owner:** Agent implements
**Guide:** `.specdev/_guides/task/implementing_guide.md`

**Process:** Create implementation.md with task list (T001, T002...); implement each task following scaffolding; apply Gate 2 validation per task (follows codestyle_guide.md; matches scaffolding; has docstrings; no syntax errors).

**Next:** All tasks complete → move to validation.

---

## Step 5: Validation

**Deliverable:** Validated, tested code
**Owner:** Agent validates
**Guide:** `.specdev/_guides/task/validation_guide.md`

**Gate 3 - Testing:** Write/run unit tests; verify coverage; all tests pass.

**Gate 4 - Integration:** End-to-end feature works as described in proposal.md; no breaking changes; dependencies declared.

**Next:** User approves validation → move to finalize.

---

## Step 6: Finalize

**Deliverable:** Updated documentation
**Owner:** Agent finalizes
**Guide:** `.specdev/_guides/task/documentation_guide.md`

**Process:** Update feature_descriptions.md (add to "Features" section; keep brief; point to scaffolding for details); update project_scaffolding/ with new file metadata; update user-facing docs if requested; mark assignment DONE in assignment_progress.md.

**Final:** Assignment complete.

---

## Key Checkpoints

- ✅ Proposal exists before planning
- ✅ Plan approved before scaffolding
- ✅ Scaffolding approved (Gate 1) before implementation
- ✅ Each task validated (Gate 2) before next
- ✅ Gates 3-4 pass before finalize
- ✅ Documentation updated before DONE

---

## Tips

- Keep proposal concise - details go in plan.md
- Ask clarifying questions during planning
- Break large tasks into subtasks (T005a, T005b)
- Flag blockers early in implementation.md
- Cross-reference assignments in project_scaffolding updates
