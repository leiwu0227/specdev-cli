# Research Notes: Email Validator Utility

## Background
Email validation is a common requirement. Need to balance between being too strict (rejecting valid emails) and too lenient (accepting invalid ones).

## Standards Reviewed
- RFC 5322: Internet Message Format
- Common regex patterns for email validation
- Python's `email.utils` module

## Key Findings
1. Perfect email validation is complex (RFC 5322 allows many edge cases)
2. Practical validation should focus on common formats: `local@domain.tld`
3. Should reject obvious errors: missing @, spaces, invalid characters

## Dependencies
- Python standard library: `re` module for regex
- No external dependencies needed

## Edge Cases to Handle
- Empty string
- Missing @ symbol
- Multiple @ symbols
- Missing domain
- Invalid characters (spaces, quotes)
- Too long addresses (>254 characters per RFC)

## Decision
Use regex-based validation that catches 99% of common cases, not 100% RFC compliance.
