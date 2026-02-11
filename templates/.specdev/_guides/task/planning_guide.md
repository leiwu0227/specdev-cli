# Planning Guide

**Reference Example**: `_templates/assignment_examples/feature/00000_feature_email-validator/plan.md`

## Planning phases

Iterate until user approves. Show progress after each phase.

1. Gather information (dependencies, constraints, existing behavior)
2. Consolidate findings
3. Identify open questions
4. Clarify with user
5. Write plan and request approval

Write research notes to `.specdev/assignments/#####_type_name/research.md`.

---

## Complexity and risk gate

After writing `plan.md`, classify assignment complexity:

- `LOW`: files touched <= 2, no shared contract changes, low blast radius
- `MEDIUM`: files touched 3-5, or new interface between modules
- `HIGH`: files touched > 5, migrations, cross-module refactor, auth/security/data integrity risk

### Required action by class

- `LOW` -> no scaffolding required
- `MEDIUM` -> invoke `skills/scaffolding-lite.md` and require Gate 1 approval (contracts only)
- `HIGH` -> invoke `skills/scaffolding-full.md` and require Gate 1 approval (full architecture)

Log the decision and reason in `plan.md` and `skills_invoked.md`.

---

## Task granularity gate

For each task in the plan:

1. Can this task be expressed as one failing test?
   - YES: size is acceptable
   - NO: decompose further
2. Does it have a clear binary success condition?
   - YES: keep
   - NO: rewrite
3. Can a subagent complete it with task text plus required artifacts?
   - YES: context is sufficient
   - NO: add missing context

---

## Optional micro-task mode

If risk/unknowns are high, invoke `skills/micro-task-planning.md`.
Use smaller tasks with per-task verification commands and rollback notes.

---

## Verification before presenting plan

- [ ] Complexity/risk class documented (`LOW`/`MEDIUM`/`HIGH`)
- [ ] Required skill invocations identified
- [ ] Every task maps to one Red-Green-Refactor cycle
- [ ] No task says "implement X and write tests later"
- [ ] Task order follows setup -> behavior slices -> integration
- [ ] Each task has enough context for isolated execution

---

*Progress update*
- [ ] Information gathering
- [ ] Consolidate findings
- [ ] Identify problems
- [ ] Clarification
- [ ] Write plan
