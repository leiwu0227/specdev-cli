*Description*
Email validation utility that checks if an email address follows standard format. Uses regex pattern matching and handles common edge cases like empty inputs, missing @ symbols, and invalid characters.

*Dependencies*
- re: Python standard library regex module

*Workflows*
1. Basic Validation Flow:
   Input: email string → Check not empty/None → Check length → Apply regex → Return (is_valid, message)

2. Error Handling Flow:
   Invalid input → Identify specific error → Return (False, descriptive_error_message)

*Examples*
```python
# Valid email
is_valid, msg = validate_email("user@example.com")
# Returns: (True, "")

# Invalid - missing @
is_valid, msg = validate_email("userexample.com")
# Returns: (False, "Email must contain @ symbol")

# Invalid - empty
is_valid, msg = validate_email("")
# Returns: (False, "Email cannot be empty")

# Invalid - too long
is_valid, msg = validate_email("a" * 300 + "@example.com")
# Returns: (False, "Email exceeds maximum length of 254 characters")

# Valid - with special characters
is_valid, msg = validate_email("user.name+tag@example.co.uk")
# Returns: (True, "")
```

*Pseudocode*

```python
import re

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
MAX_EMAIL_LENGTH = 254

def validate_email(email: str) -> tuple[bool, str]:
    # Validates email address format
    # Input: email (str) - email address to validate
    # Output: tuple (bool, str) - (is_valid, error_message)
    # Raises: None (returns error messages instead)

    # Pseudo code:
    # 1. Check if email is None, if so return (False, "Email cannot be None")
    # 2. Convert email to string if not already, strip whitespace
    # 3. Check if email is empty string, if so return (False, "Email cannot be empty")
    # 4. Check if email length exceeds MAX_EMAIL_LENGTH, if so return (False, "Email exceeds maximum length of 254 characters")
    # 5. Check if email contains @ symbol, if not return (False, "Email must contain @ symbol")
    # 6. Count @ symbols, if more than one return (False, "Email cannot contain multiple @ symbols")
    # 7. Split email by @ to get local and domain parts
    # 8. Check if local part is empty, if so return (False, "Email must have characters before @")
    # 9. Check if domain part is empty, if so return (False, "Email must have domain after @")
    # 10. Check if domain contains a dot, if not return (False, "Domain must contain at least one dot")
    # 11. Apply EMAIL_REGEX pattern to full email
    # 12. If regex matches, return (True, "")
    # 13. If regex doesn't match, return (False, "Email format is invalid")
```
