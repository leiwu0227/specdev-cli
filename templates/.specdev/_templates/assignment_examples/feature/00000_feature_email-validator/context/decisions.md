# Decisions Log

## Decision 1: Regex-based validation over library
- **Date:** (during planning)
- **Context:** Considered using `email-validator` library vs custom regex
- **Decision:** Custom regex — no external dependencies, sufficient for format validation
- **Rationale:** RFC 5322 full compliance is a non-goal; simple format checking meets all use cases

## Decision 2: Tuple return type over exceptions
- **Date:** (during planning)
- **Context:** Could raise exceptions on invalid email or return a result tuple
- **Decision:** Return `(bool, str)` tuple
- **Rationale:** Caller-friendly, no try/catch needed, error message always available
