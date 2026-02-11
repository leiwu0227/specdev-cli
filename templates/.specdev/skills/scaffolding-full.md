# Skill: Scaffolding Full

## Use when

- More than 5 files are touched
- Cross-module refactor or migration is involved
- Security/auth/payment/data integrity risk is high

## Deliverable

- `scaffold/` file per source module (one document per source file)
- `scaffold/_architecture.md` with dependency graph and integration flow

Each scaffold file includes:

- Description
- Dependencies
- Workflows
- Examples
- Pseudocode

## Acceptance

- No circular dependency
- All contracts and error paths specified
- User approves Gate 1 before implementation
