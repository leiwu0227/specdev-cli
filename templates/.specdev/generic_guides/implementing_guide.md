# Implementation Guide

## Purpose
Transform approved scaffolding into working code through structured tasks.

**Reference Example**: See `.specdev/features/000_example_feature/implementation.md` for a complete task list example.

## When to Implement
After Gate 1 (scaffolding approval) passes.

---

## Step 1: Create Tasks

### Task Format
Each task should have:
- **Task ID**: T001, T002, etc.
- **Action**: "Implement [function/class]" or "Create [file]"
- **File**: Which file to create/modify
- **Scaffolding**: Which scaffold file to reference
- **Dependencies**: Which tasks must complete first (or "None")

### Task Example
```
**T003: Implement email validation**
- File: utils/validator.py
- Scaffolding: scaffold/utils_validator.md
- Dependencies: T001
```

### Task Order
1. Setup tasks (dependencies, folder structure)
2. Low-level utilities (no dependencies)
3. Models and business logic
4. API/CLI interfaces
5. Tests
6. Examples (if needed)

### Parallelizable Tasks
Mark with `[P]` if tasks modify different files and have no dependencies:
```
**T005: [P] Implement user model**
**T006: [P] Implement post model**
```

Otherwise, tasks run sequentially.

### Save Tasks
Create `.specdev/features/###_featurename/implementation.md` with all tasks listed.

---

## Step 2: Execute Tasks

For each task:
1. Read the scaffolding document
2. Implement the code following scaffolding pseudocode
3. Apply Gate 2 validation (see validation_guide.md):
   - Code follows codestyle_guide.md
   - Function signatures match scaffolding
   - Has docstrings
   - No syntax errors
4. Mark task complete in validation_checklist.md
5. Move to next task

### File Locations
- Source code: As specified in plan.md
- Tests: project_root/tests/
- Examples: project_root/examples/

---

## Handling Issues

### Task Fails Gate 2
1. Fix the issue
2. Re-validate
3. Don't proceed until passing

### Task Too Large
Split into subtasks: T005a, T005b

### Scaffolding Wrong
1. Stop implementation
2. Fix scaffolding
3. Get user approval (Gate 1 again)
4. Resume

### Blocked Task
Document blocker in implementation.md and move to next independent task if possible.

---

## Step 3: Final Validation

After all tasks complete:
1. Gate 3: Write and run tests
2. Gate 4: Test end-to-end integration
3. Gate 5: Update documentation
4. Mark feature complete in feature_progress.md

---

## Example

```markdown
# Implementation Tasks

**T001: Create validator module**
- File: utils/validator.py
- Scaffolding: scaffold/utils_validator.md
- Dependencies: None

**T002: Implement validate_email function**
- File: utils/validator.py
- Scaffolding: scaffold/utils_validator.md
- Dependencies: T001

**T003: Write tests for validator**
- File: tests/test_validator.py
- Dependencies: T002
```

Execution:
- T001 → Gate 2 ✓ → Complete
- T002 → Gate 2 ✓ → Complete
- T003 → Gate 2 ✓ → Complete
- Gates 3-5 → Feature DONE
