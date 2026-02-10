# Task Spec: Implement Email Validator

## Objective
Create `utils/validator.py` with a `validate_email()` function.

## Inputs
- Scaffold: `scaffold/utils_validator.md`
- Plan: `plan.md` (Architecture and Validation Approach sections)

## Acceptance Criteria
- Function accepts a string, returns `(bool, str)` tuple
- Handles: None, empty, too long (>254), missing @, invalid domain, invalid local part
- Uses regex pattern from plan
- No external dependencies

## Constraints
- Single file, single public function
- Follow project codestyle conventions
