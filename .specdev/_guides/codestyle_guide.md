## Coding Philosophy

**Independent Modules**

- Each module stands alone and covers one domain.
- Use explicit imports. Do not hide dependencies between modules.
- Benefit: Users can pick and choose without tight coupling.

**Pure by Default (No Side Effects)**

- Pure functions return the same output for the same input.
- Do not hide state changes, except where classes require them.
- Functions should not modify inputs.
- Allowed exception: clearly named setup/config functions (e.g., setup_logging) that establish global state.
- Benefit: Predictable, testable, and safe for parallel use.

**Single-Responsibility Functions**

- Each function does one thing clearly.
- Use simple signatures and clear names. Avoid large configuration dictionaries unless that flexibility is the goal.
- Benefit: Easier to read, test, and maintain.

**Be Explicit**

- Behavior and return types are consistent and predictable.
- Include example output in the comment.
- Required params are positional; optional params are keyword with defaults.
- Benefit: No surprises; intent is clear from the signature.

**Documentation**

- Public functions have docstrings (purpose, params, returns).
- Complex logic has inline comments.
- Add example notebooks for major modules only when the user requests them.

**Code Organization**

- No circular imports.
