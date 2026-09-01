# Explicit Human Authority

Status: implemented

## Decision

The user is the source of authority for product changes and shared project
memory. Automation may execute a direct request, exact approval, or bounded
authority delegated by an approved contract; it may not silently broaden that
authority because adjacent work appears useful.

Approval-gated work binds exact contract or content bytes. Exploration does not
silently authorize implementation, and implementation does not silently
authorize knowledge or protected-note publication. Mission children may derive
work within an approved parent contract but require a visible reapproval
boundary before exceeding it. Required reviewers inspect and report; they do
not repair the candidate they judge.

Weakening these boundaries, accepting mutated content under an older approval,
or merging author and required-reviewer authority requires explicit user
notification and approval as an architecture change.

## Verification

Aligned at Git revision `ea92c919fc46350f6041100d89712dda9bcface9` against
`src/utils/assignment-vnext.js`, `src/commands/reviewloop.js`,
`src/utils/shared-publication.js`, and `templates/.specdev/_main.md`.
