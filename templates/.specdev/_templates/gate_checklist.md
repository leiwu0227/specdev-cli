# Gate Checklist Template

Copy this into assignment folder as `validation_checklist.md`.

---

## Gate 0: Planning Complexity and Skill Selection

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] Complexity class set: LOW / MEDIUM / HIGH
- [ ] Required skills selected and logged in `skills_invoked.md`
- [ ] Skill artifacts listed with expected paths

---

## Gate 1: Post-Architecture Review (conditional)

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed / ⏭️ Skipped

- [ ] Skip only if complexity is LOW
- [ ] MEDIUM complexity: `scaffold/_architecture.md` produced, user approved contracts
- [ ] HIGH complexity: full architecture artifacts complete, user approved before implementation

---

## Gate 2: Per-Task TDD Validation

| Task ID | Description | RED ✓ | GREEN ✓ | REFACTOR ✓ | Date |
|---------|-------------|-------|---------|------------|------|
| T001 | [Task name] | ⬜ / ✅ | ⬜ / ✅ | ⬜ / ✅ | YYYY-MM-DD |

Per-task checks:

- [ ] Failing test before production code
- [ ] Correct failure reason
- [ ] Minimum code to pass
- [ ] All tests pass
- [ ] Contracts/signatures align with planned artifacts

---

## Gate 3: Stage 1 Spec Compliance Review

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] Review packet prepared with changed files + plan/proposal scope
- [ ] Verdict captured: PASS / FAIL
- [ ] Deviations listed as `file:line` with expected vs actual

---

## Gate 4: Stage 2 Code Quality Review

**Status:** ⬜ Not Started / 🔄 In Progress / ✅ Passed

- [ ] Verdict captured: READY TO MERGE / NOT READY
- [ ] Findings tagged CRITICAL / IMPORTANT / MINOR
- [ ] Each finding has `file:line`, impact, proposed fix
- [ ] Feedback disposition captured (fixed/disagree with evidence)

---

## Verification Evidence (required before completion)

| Command | Exit Code | Key Output | Notes |
|---------|-----------|------------|-------|
| [command] | 0 | [summary line] | [context] |

---

## Finalize

- [ ] `feature_descriptions.md` updated (if applicable)
- [ ] `project_scaffolding/` updated
- [ ] `skills_invoked.md` complete
- [ ] assignment marked DONE in `assignment_progress.md`

## Knowledge Capture

- [ ] Learnings distilled into relevant `knowledge/` branches
- [ ] Workflow observations noted in `knowledge/_workflow_feedback/` (if applicable)

---

## Notes

Use for blockers, deviations, rollback rationale, and follow-up assignments.
