# Validation & Quality Gates Guide

## Purpose
Define quality standards and checkpoints to ensure assignments are complete, correct, and maintainable before marking them as done.

**Reference Example**: See `.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/validation_checklist.md` for a completed checklist example.

## Quality Gates

### Gate 1: Post-Scaffolding Review
**When**: After scaffolding documents are created, before implementation starts

**Checklist**:
- [ ] All functions/classes have clear purpose descriptions
- [ ] Input/output types are specified
- [ ] Edge cases are identified in pseudocode
- [ ] Dependencies between files are documented
- [ ] No circular dependencies in design

**Action**: User must approve scaffolding before moving to implementation

### Gate 2: Per-Task Validation
**When**: After each implementation task (T001, T002, etc.) is completed

**Checklist**:
- [ ] Code follows codestyle_guide.md principles
- [ ] Function signatures match scaffolding
- [ ] Docstrings present for public functions
- [ ] No syntax errors (code runs/compiles)

**Action**: Move to next task only if validation passes

### Gate 3: Testing Gate
**When**: After core implementation, before marking the assignment complete

**Checklist**:
- [ ] Unit tests exist for all public functions
- [ ] Tests cover happy path
- [ ] Tests cover error cases/edge cases
- [ ] All tests pass
- [ ] Test files in project_root/tests/

**Minimum Coverage**:
- Core functionality: 80% coverage recommended
- Utility functions: 100% coverage recommended

### Gate 4: Integration Validation
**When**: After all tasks complete, before assignment sign-off

**Checklist**:
- [ ] Assignment works end-to-end as described in proposal.md
- [ ] No breaking changes to existing assignments
- [ ] Dependencies properly declared
- [ ] Examples work (if examples were created)
- [ ] No hardcoded values (configs externalized)


## Next Step

After Gates 3-4 pass and user approves validation:
- Move to finalize step (see workflow guide for your assignment type)

## Rollback Procedures

### When to Rollback
- Critical bugs discovered during Gate 3 or 4
- Implementation doesn't match approved plan
- Assignment breaks existing functionality
- User requests abandonment

### Rollback Steps
1. Document reason in assignment folder: `#####_type_name/rollback_notes.md`
2. Revert code commits related to the assignment
3. Mark assignment as "Rolled Back" in assignment_progress.md
4. Decide: Fix and retry, or abandon the assignment

### Partial Rollback
If only some tasks are problematic:
1. Keep working code
2. Revert problematic tasks
3. Update implementation.md with revised tasks
4. Resume from Gate 2 for revised tasks

## Validation Workflow

```
Scaffolding → Gate 1 ✓ → Implementation → Gate 2 (per task) ✓ →
Gate 3 (testing) ✓ → Gate 4 (integration) ✓ → Gate 5 (docs) ✓ →
DONE
```

If any gate fails:
- Document failures
- Fix issues
- Re-validate at that gate
- Do not proceed until gate passes

## Quality Checklist Template

**Use the template:** Copy `.specdev/_templates/gate_checklist.md` into your assignment folder as `validation_checklist.md` and track progress through each gate.
