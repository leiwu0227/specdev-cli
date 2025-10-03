# Bugfix Assignment Workflow

## Purpose
Guide coding agents through diagnosing, fixing, and validating defects.

---

## Step 1: Proposal

**Deliverable:** `proposal.md`
**Owner:** User
**Guide:** User creates this file

**Key content:** Bug description; reproduction steps; expected vs actual behavior; impact/severity (critical, high, medium, low); affected components; error messages/logs/screenshots.

**Next:** Agent may suggest improvements (requires user approval); decide if planning needed (complex bug → create plan; simple bug → skip to scaffolding).

---

## Step 2: Plan [OPTIONAL]

**Deliverable:** `plan.md`
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/planning_guide.md`

**When to use:** Complex bugs with unclear root cause; bugs affecting multiple components; high-risk fixes requiring rollback strategy; significant investigation needed.

**When to skip:** Simple, obvious bugs with clear fix; single-line fixes; well-understood issues.

**Key content:** Reproduction strategy; root cause analysis approach; affected files; fix approach; rollback strategy (for high-risk); testing strategy.

**Next:** User approval required before scaffolding.

---

## Step 3: Scaffolding

**Deliverable:** `scaffold/` directory with scaffolding documents
**Owner:** Agent writes, user approves
**Guide:** `.specdev/_guides/task/scaffolding_guide.md`

**Process:** Read approved plan.md (or proposal.md if plan skipped); create scaffolds for files to modify and test files to add (failing tests that will pass after fix); include Description, Dependencies, Workflows, Examples (bug scenario + expected fix), Pseudocode.

**Gate 1:** User must approve scaffolding before implementation.

---

## Step 4: Implementation

**Deliverable:** Bug fix code and tests
**Owner:** Agent implements
**Guide:** `.specdev/_guides/task/implementing_guide.md`

**Process:** Create implementation.md with task list; **CRITICAL:** first reproduce bug and add failing test; implement fix following scaffolding; apply Gate 2 validation per task (follows codestyle_guide.md; matches scaffolding; has docstrings; no syntax errors; new test passes; all existing tests pass).

**Next:** All tasks complete → move to validation.

---

## Step 5: Validation

**Deliverable:** Validated, tested bug fix with regression coverage
**Owner:** Agent validates
**Guide:** `.specdev/_guides/task/validation_guide.md`

**Gate 3 - Testing:** Reproduction test passes (bug is fixed); all existing tests pass (no regressions); edge cases covered; test coverage maintained or improved.

**Gate 4 - Integration:** Fix works in representative environments; no breaking changes introduced; dependencies updated; bug cannot be reproduced in end-to-end testing.

**Next:** User approves validation → move to finalize.

---

## Step 6: Finalize

**Deliverable:** Updated documentation
**Owner:** Agent finalizes
**Guide:** `.specdev/_guides/task/documentation_guide.md`

**Process:** Document resolution notes (what caused bug, how fixed); update project_scaffolding/ with patched files; update runbooks or troubleshooting guides if applicable; update monitoring/alerts if they contributed; create follow-up tickets for deeper issues; mark assignment DONE in assignment_progress.md.

**Note:** Bugfix assignments typically don't update feature_descriptions.md (they fix existing features).

**Final:** Assignment complete.

---

## Key Checkpoints

- ✅ Proposal includes reproduction steps
- ✅ Plan created if bug is complex (optional)
- ✅ Scaffolding includes failing test (Gate 1)
- ✅ Bug reproduced and failing test added before fix (Gate 2)
- ✅ Fix validated and no regressions (Gates 3-4)
- ✅ Resolution documented before DONE

---

## Bugfix-Specific Tips

- **Reproduce first** - Always verify you can trigger the bug before fixing
- **Add failing test** - Write test that fails with bug, passes after fix
- **Track reproduction** - Document confirmed/unconfirmed status with evidence
- **Isolate root cause** - Don't just fix symptoms, find the real issue
- **Test edge cases** - Bug might manifest differently in edge scenarios
- **Document resolution** - Future developers need to know what was fixed and why
- **Watch for scope creep** - If deeper issues surface, create separate assignments
- **Keep rollback ready** - For high-risk fixes, have rollback or feature-flag strategy
- **Can't reproduce?** - Document hypotheses and suggest next steps before closing
- **Update monitoring** - Adjust alerts/analytics if they missed or caused the bug
