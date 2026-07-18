*Description*
Comprehensive unit tests for the email validator utility. Tests all edge cases including valid formats, invalid formats, empty inputs, and boundary conditions.

*Dependencies*
- pytest: Testing framework
- utils.validator: validate_email function being tested

*Workflows*
1. Test Execution Flow:
   Setup test data → Run test cases → Assert expected results → Report pass/fail

*Examples*
```python
# Test valid email
def test_valid_simple_email():
    is_valid, msg = validate_email("user@example.com")
    assert is_valid == True
    assert msg == ""

# Test invalid email
def test_invalid_missing_at():
    is_valid, msg = validate_email("userexample.com")
    assert is_valid == False
    assert "@ symbol" in msg
```

*Pseudocode*

```python
import pytest
from utils.validator import validate_email

def test_valid_simple_email():
    # Tests that a simple valid email passes validation
    # Input: None
    # Output: None (assertions verify correctness)
    # Raises: AssertionError if test fails

    # Pseudo code:
    # 1. Call validate_email with "user@example.com"
    # 2. Assert that is_valid is True
    # 3. Assert that error message is empty string

def test_valid_email_with_dots():
    # Tests that emails with dots in local part are valid
    # Pseudo code:
    # 1. Call validate_email with "user.name@example.com"
    # 2. Assert that is_valid is True
    # 3. Assert that error message is empty string

def test_valid_email_with_plus():
    # Tests that emails with plus signs are valid
    # Pseudo code:
    # 1. Call validate_email with "user+tag@example.com"
    # 2. Assert that is_valid is True
    # 3. Assert that error message is empty string

def test_valid_email_with_subdomain():
    # Tests that emails with subdomains are valid
    # Pseudo code:
    # 1. Call validate_email with "user@mail.example.com"
    # 2. Assert that is_valid is True
    # 3. Assert that error message is empty string

def test_invalid_empty_string():
    # Tests that empty string is rejected
    # Pseudo code:
    # 1. Call validate_email with ""
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "empty"

def test_invalid_none():
    # Tests that None input is rejected
    # Pseudo code:
    # 1. Call validate_email with None
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "None"

def test_invalid_missing_at():
    # Tests that email without @ is rejected
    # Pseudo code:
    # 1. Call validate_email with "userexample.com"
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "@ symbol"

def test_invalid_multiple_at():
    # Tests that email with multiple @ symbols is rejected
    # Pseudo code:
    # 1. Call validate_email with "user@@example.com"
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "multiple"

def test_invalid_missing_domain():
    # Tests that email without domain is rejected
    # Pseudo code:
    # 1. Call validate_email with "user@"
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "domain"

def test_invalid_missing_local():
    # Tests that email without local part is rejected
    # Pseudo code:
    # 1. Call validate_email with "@example.com"
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "before @"

def test_invalid_too_long():
    # Tests that emails exceeding 254 characters are rejected
    # Pseudo code:
    # 1. Create an email string longer than 254 characters
    # 2. Call validate_email with this long email
    # 3. Assert that is_valid is False
    # 4. Assert that error message contains "length"

def test_invalid_no_dot_in_domain():
    # Tests that domain without dot is rejected
    # Pseudo code:
    # 1. Call validate_email with "user@examplecom"
    # 2. Assert that is_valid is False
    # 3. Assert that error message contains "dot"

def test_invalid_special_characters():
    # Tests that invalid special characters are rejected
    # Pseudo code:
    # 1. Call validate_email with "user name@example.com" (with space)
    # 2. Assert that is_valid is False
    # 3. Assert that error message indicates invalid format
```
