# Gate Checklist Template

Copy this into your assignment folder as `validation_checklist.md` and track progress through each gate.

---

## Gate 1: Post-Scaffolding Review

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] All functions/classes have clear purpose descriptions
- [ ] Input/output types are specified
- [ ] Edge cases identified in pseudocode
- [ ] Dependencies between files documented
- [ ] No circular dependencies in design
- [ ] **User approved scaffolding** (Date: __________)

---

## Gate 2: Per-Task TDD Validation

Track each implementation task (each row = one Red-Green-Refactor cycle):

| Task ID | Description | RED ✓ | GREEN ✓ | REFACTOR ✓ | Date |
|---------|-------------|-------|---------|------------|------|
| T001 | [Task name] | ⬜ / ✅ | ⬜ / ✅ | ⬜ / ✅ | YYYY-MM-DD |
| T002 | [Task name] | ⬜ / ✅ | ⬜ / ✅ | ⬜ / ✅ | YYYY-MM-DD |

**Per-task TDD checklist:**
- [ ] Failing test written BEFORE production code
- [ ] Test fails for the correct reason
- [ ] Production code is minimum to pass test
- [ ] ALL tests pass (new + existing)
- [ ] Code follows codestyle_guide.md
- [ ] Function signatures match scaffolding

---

## Gate 3: Stage 1 — Spec Compliance Review

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

**Reviewer**: Spec compliance subagent (skeptical stance)

- [ ] Every feature in proposal.md has corresponding implementation
- [ ] Function signatures match scaffolding exactly
- [ ] Edge cases from plan.md are handled
- [ ] No unplanned features added (scope creep)
- [ ] File structure matches plan.md

**Verdict:** PASS / FAIL
**Deviations found (if any):**
- [file:line] — expected X, found Y

---

## Gate 4: Stage 2 — Code Quality Review

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

**Reviewer**: Code quality subagent

| Category | Status | Issues |
|----------|--------|--------|
| Code Quality | ⬜ / ✅ | |
| Architecture | ⬜ / ✅ | |
| Testing | ⬜ / ✅ | |
| Requirements | ⬜ / ✅ | |
| Security | ⬜ / ✅ | |

**Issues found:**
- [ ] CRITICAL: (describe) — [file:line]
- [ ] IMPORTANT: (describe) — [file:line]
- [ ] MINOR: (describe) — [file:line]

**Verdict:** READY TO MERGE / NOT READY

**Assignment-specific:**
- [ ] **Feature:** New capability works as specified
- [ ] **Refactor:** Behavior unchanged, all existing tests pass
- [ ] **Bugfix:** Bug cannot be reproduced, regression test added

---

## Finalize: Documentation Updates

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Complete

**Guide Reference:** `.specdev/_guides/task/documentation_guide.md`

- [ ] `.specdev/project_notes/feature_descriptions.md` updated (feature/refactor only)
- [ ] `.specdev/project_scaffolding/` updated with latest state
- [ ] proposal.md and plan.md are accurate
- [ ] README/docs updated if user-facing (when requested)
- [ ] Complex algorithms have inline comments
- [ ] Examples exist in `project_root/examples/` (if needed)

**Project scaffolding updates:**
For each new/modified file, add/update entry in `.specdev/project_scaffolding/`:
- [ ] File: __________________ (updated: YYYY-MM-DD)
- [ ] File: __________________ (updated: YYYY-MM-DD)

**Feature descriptions update (if applicable):**
- [ ] Entry added to appropriate section (Features/Architecture/System Documentation)

---

## Final Sign-off

**Validation gates passed:**
- [ ] Gate 1: Scaffolding ✅
- [ ] Gate 2: Per-task TDD ✅
- [ ] Gate 3: Spec compliance review ✅
- [ ] Gate 4: Code quality review ✅

**Documentation finalized:**
- [ ] Documentation updates complete ✅

**Assignment completion:**
- [ ] Code committed to repository
- [ ] Assignment marked DONE in `.specdev/project_notes/assignment_progress.md`
- [ ] Date completed: __________
- [ ] No known blockers or critical bugs

---

## Notes

Use this section for:
- Gate failure reasons and resolutions
- Blockers encountered
- Deviations from original plan
- Follow-up assignments created
