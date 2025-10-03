# Scaffolding Guide

## Purpose
Create detailed scaffolding documents that serve as blueprints for implementation. Good scaffolding reduces ambiguity, catches design issues early, and enables clear implementation.

**Reference Example**: See `.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/scaffold/` for complete scaffolding examples.

## When to Scaffold

Create scaffolding documents during Step 3 of the assignment development process, after plan.md is approved but before implementation begins.

## File Mapping Rules

### Rule 1: One Scaffolding Document Per Source File
- Each source file that will be implemented gets exactly one scaffolding markdown file
- Naming convention: If implementing `src/auth/login.py`, create `scaffold/auth_login.md`
- If implementing `utils/validator.js`, create `scaffold/utils_validator.md`

### Rule 2: Skip Non-Source Files
Do NOT scaffold:
- Test files (tests will be written during implementation)
- Config files (JSON, YAML, etc. with no logic)
- Documentation files
- Data files

### Rule 3: Dependency Order
List scaffolding files in dependency order in plan.md:
1. Low-level utilities first (no dependencies)
2. Core models/data structures
3. Business logic that uses models
4. API/CLI interfaces last

## Handling Dependencies Between Files

### Explicit Dependency Declaration
In each scaffolding file, add a dependencies section at the top:

**Format:**
```
*Dependencies*
- filename.py: function_name(), ClassName
- another_file.py: utility_function()
```

**Example:**
```
*Dependencies*
- utils/validator.py: validate_email(), validate_password()
- models/user.py: User class
- config/database.py: get_db_connection()
```

### Circular Dependency Detection
If file A needs B, and B needs A:
- ❌ BAD: Keep circular dependency
- ✅ GOOD: Extract shared logic to file C, both A and B depend on C
- Document the refactoring in scaffolding comments

### Import Specifications
Be explicit about what gets imported in the pseudocode:
```python
# At top of pseudocode section:
from utils.validator import validate_email
from models.user import User
import logging
```

## When to Merge vs Split Scaffolding

Since scaffolding goes through Gate 1 approval, use your judgment:

### Consider Merging:
- Files are tightly coupled and always change together
- Combined complexity is manageable

### Consider Splitting:
- File will be very large (>200 lines)
- Multiple distinct responsibilities
- Easier to understand as separate pieces

**Note:** User will review and can request changes during Gate 1, so optimize for clarity.

## Scaffolding Completeness Checklist

Before submitting for Gate 1 review, verify each scaffolding file has:

### Required Sections (from template)
- [ ] *Description* - Clear high-level purpose
- [ ] *Dependencies* - All external files/functions listed
- [ ] *Workflows* - End-to-end flow for main use cases
- [ ] *Examples* - Input/output examples showing usage
- [ ] *Pseudocode* - Complete pseudocode for all functions/classes

### Quality Criteria
- [ ] All functions have input/output types specified
- [ ] All error cases documented
- [ ] Edge cases explicitly mentioned
- [ ] Pseudocode uses descriptive sentences, not code syntax
- [ ] No ambiguous "etc." without explanation

## Examples

### ❌ BAD Scaffolding Example:

```markdown
*Description*
Handles user stuff

*Pseudocode*
```python
def process_user(data):
    # does user things
    # validates and saves
```
```

**Problems:**
- Vague description ("user stuff")
- No *Dependencies* section
- No *Workflows* section
- No *Examples* section
- No input/output types
- Pseudocode too vague
- No error handling

### ✅ GOOD Scaffolding Example:

```markdown
*Description*
Validates and creates new user accounts. Checks email uniqueness, password strength, and persists to database.

*Dependencies*
- utils/validator.py: validate_email(), validate_password()
- models/user.py: User class
- database/connection.py: get_db_session()

*Workflows*
1. User Registration Flow:
   Input: email, password, name → Validate email → Validate password → Check uniqueness → Create User → Save to DB → Return User object

*Examples*
```python
# Success case
user = create_user("john@example.com", "SecurePass123!", "John Doe")
# Returns: User(id=1, email="john@example.com", name="John Doe")

# Failure case - invalid email
user = create_user("invalid-email", "SecurePass123!", "John")
# Raises: ValidationError("Invalid email format")

# Failure case - weak password
user = create_user("john@example.com", "123", "John")
# Raises: ValidationError("Password must be at least 8 characters")

# Failure case - duplicate email
user = create_user("existing@example.com", "SecurePass123!", "John")
# Raises: ValidationError("Email already registered")
```

*Pseudocode*
```python
from utils.validator import validate_email, validate_password
from models.user import User
from database.connection import get_db_session

def create_user(email: str, password: str, name: str) -> User:
    # Creates a new user account with validation
    # Input: email (str), password (str), name (str)
    # Output: User object with id assigned
    # Raises: ValidationError if validation fails, DatabaseError if save fails

    # Pseudo code:
    # 1. Validate the email format using the validate_email function
    # 2. If email is invalid, raise a ValidationError with message "Invalid email format"
    # 3. Validate the password strength using the validate_password function
    # 4. If password is weak, raise a ValidationError with the specific weakness message
    # 5. Query the database to check if a user with this email already exists
    # 6. If a user exists, raise a ValidationError with message "Email already registered"
    # 7. Create a new User object with the provided email and name
    # 8. Set the user's password using the set_password method which will hash it
    # 9. Get a database session and add the user to it
    # 10. Commit the transaction to save the user to the database
    # 11. If commit fails, rollback and raise a DatabaseError
    # 12. Return the created user object with the database-assigned id
```
```

**Why this is good:**
- Clear, specific description
- All dependencies listed with function names
- Workflow shows complete flow
- Examples cover success + multiple failure cases
- Pseudocode is descriptive sentences (what to do, not how)
- Error cases documented
- Input/output types specified

## Scaffolding Best Practices

### 1. Use Descriptive Sentences in Pseudocode
- Write what the code should do, not how to implement it
- Good: "Validate the email format using the validate_email function"
- Bad: "is_valid = validate_email(email)"

### 2. Include Edge Cases in Examples
Document handling for:
- Empty/null inputs
- Out of range values
- Duplicate data
- Missing dependencies
- Database/network failures

### 3. Specify Error Handling
For each function, document:
- What errors can be raised/returned
- When each error occurs
- Exact error messages

### 4. Show Data Transformations in Workflows
Use arrows to show how data changes:
```
Input: "john@example.com" → Validation → User object → Database → User(id=1)
```

### 5. Follow the Template Exactly
All scaffolding files MUST follow the format in `.specdev/templates/scaffolding_template.md`

## Common Mistakes to Avoid

1. **Missing Dependencies** - Always list what files/functions are imported
2. **Code-like Pseudocode** - Use sentences, not code syntax
3. **No Examples** - Examples clarify intent better than descriptions
4. **Missing Error Cases** - Document all failure modes
5. **Ignoring Template** - Must include all required sections
