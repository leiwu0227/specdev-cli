# Implementation Plan: Email Validator Utility

## Summary
Create a simple email validation utility module with a single public function that uses regex to validate email format.

## Complexity Gate

- Class: LOW
- Rationale: single source file, no shared contract across modules, low blast radius
- Required skills: none

## Tech Stack
- Language: Python 3.8+
- Dependencies: None (uses standard library only)
- Testing: pytest

## Architecture

### Module Structure
```
utils/
└── validator.py    # Contains validate_email() function
```

### Public API
```python
validate_email(email: str) -> tuple[bool, str]
```
- Input: email string
- Output: (is_valid, error_message)
- Returns (True, "") if valid
- Returns (False, "error message") if invalid

## Implementation Steps

1. Setup: create `utils/validator.py` module and test framework
2. Validate basic format: test rejects missing `@` -> implement check
3. Validate empty/None: test rejects empty input -> implement guard
4. Validate length: test rejects >254 chars -> implement length check
5. Validate full regex: test accepts valid format -> implement regex
6. Edge cases: test special chars, unicode, multiple `@` -> handle each
7. Create usage examples

## Validation Approach
- Check for None/empty
- Check length (<= 254 characters)
- Regex pattern: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- Return clear error messages for each failure case

## Testing Strategy
- Unit tests for all edge cases
- Test valid emails (simple, with dots, with special chars)
- Test invalid emails (missing @, multiple @, invalid chars, too long)
- Aim for 100% code coverage

## File Locations
- Source: `utils/validator.py`
- Tests: `tests/test_validator.py`
- Examples: `examples/validator_example.py`

## Success Criteria
- All tests pass
- Function handles all documented edge cases
- Code follows codestyle_guide.md principles
- Documentation is clear and complete
