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

## Gate 2: Per-Task Validation

Track each implementation task:

| Task ID | Description | Status | Date |
|---------|-------------|--------|------|
| T001 | [Task name] | ⬜ / ✅ | YYYY-MM-DD |
| T002 | [Task name] | ⬜ / ✅ | YYYY-MM-DD |

**Per-task checklist:**
- [ ] Code follows codestyle_guide.md
- [ ] Function signatures match scaffolding
- [ ] Docstrings present for public functions
- [ ] No syntax errors

---

## Gate 3: Testing

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] Unit tests exist for all public functions
- [ ] Tests cover happy path
- [ ] Tests cover error cases/edge cases
- [ ] All tests pass
- [ ] Test files in `project_root/tests/`
- [ ] Coverage: _____% (target: 80%+ for core, 100% for utils)

---

## Gate 4: Integration

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] Assignment works end-to-end as described in proposal.md
- [ ] No breaking changes to existing assignments
- [ ] Dependencies properly declared
- [ ] Examples work (if created)
- [ ] No hardcoded values (configs externalized)

**Assignment-specific:**
- [ ] **Feature:** New capability works as specified
- [ ] **Refactor:** Behavior unchanged, all existing tests pass
- [ ] **Bugfix:** Bug cannot be reproduced, regression test added
- [ ] **Familiarization:** Findings validated with user/SME

---

---

## Finalize: Documentation Updates

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Complete

**Guide Reference:** `.specdev/_guides/task/documentation_guide.md`

- [ ] `.specdev/project_notes/feature_descriptions.md` updated (feature/refactor/familiarization only)
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
- [ ] Gate 2: Implementation ✅
- [ ] Gate 3: Testing ✅
- [ ] Gate 4: Integration ✅

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
