# Validation & Quality Gates Guide

## Purpose
Define quality standards and checkpoints to ensure features are complete, correct, and maintainable before marking them as done.

**Reference Example**: See `.specdev/features/000_example_feature/validation_checklist.md` for a completed checklist example.

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
**When**: After core implementation, before marking feature complete

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
**When**: After all tasks complete, before feature sign-off

**Checklist**:
- [ ] Feature works end-to-end as described in proposal.md
- [ ] No breaking changes to existing features
- [ ] Dependencies properly declared
- [ ] Examples work (if examples were created)
- [ ] No hardcoded values (configs externalized)

### Gate 5: Documentation Completeness
**When**: Before marking feature as complete

**Checklist**:
- [ ] proposal.md exists and is accurate
- [ ] plan.md reflects what was actually built
- [ ] README/docs updated if feature is user-facing (when user requests)
- [ ] Complex algorithms have inline comments
- [ ] Examples exist in project_root/examples/ (if needed)

## Definition of Done

A feature is considered **DONE** when:
1. All 5 quality gates pass
2. Code is committed to repository
3. Feature marked as complete in .specdev/project_notes/feature_progress.md
4. No known blockers or critical bugs

## Rollback Procedures

### When to Rollback
- Critical bugs discovered during Gate 3 or 4
- Implementation doesn't match approved plan
- Feature breaks existing functionality
- User requests abandonment

### Rollback Steps
1. Document reason in feature folder: `###_featurename/rollback_notes.md`
2. Revert code commits related to feature
3. Mark feature as "Rolled Back" in feature_progress.md
4. Decide: Fix and retry, or Abandon feature

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

Save this in feature folder as `validation_checklist.md`:

```
# Validation Checklist: [Feature Name]

## Gate 1: Post-Scaffolding
- [ ] All functions/classes have clear purpose descriptions
- [ ] Input/output types are specified
- [ ] Edge cases are identified in pseudocode
- [ ] Dependencies between files are documented
- [ ] No circular dependencies in design
- [ ] User approved: [Date]

## Gate 2: Per-Task (track each task)
- [ ] T001: Validated [Date]
- [ ] T002: Validated [Date]
(Add more as needed)

## Gate 3: Testing
- [ ] Unit tests exist for all public functions
- [ ] Tests cover happy path
- [ ] Tests cover error cases/edge cases
- [ ] All tests pass
- [ ] Test files in project_root/tests/
- [ ] Coverage: [X%]

## Gate 4: Integration
- [ ] Feature works end-to-end as described in proposal.md
- [ ] No breaking changes to existing features
- [ ] Dependencies properly declared
- [ ] Examples work (if examples were created)
- [ ] No hardcoded values (configs externalized)

## Gate 5: Documentation
- [ ] proposal.md exists and is accurate
- [ ] plan.md reflects what was actually built
- [ ] README/docs updated if feature is user-facing
- [ ] Complex algorithms have inline comments
- [ ] Examples exist in project_root/examples/ (if needed)

## Final Sign-off
- [ ] All gates passed
- [ ] Code committed to repository
- [ ] Feature marked DONE in feature_progress.md
- [ ] Date completed: [Date]
```
