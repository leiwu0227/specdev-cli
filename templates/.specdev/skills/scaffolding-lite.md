# Skill: Scaffolding Lite

## Use when

- 3-5 files are touched
- A new interface or contract is introduced
- Full pseudocode would add little value

## Deliverable

Create `scaffold/_architecture.md` with:

- Module/file dependency map
- New or changed public interfaces (signatures + types)
- Critical edge cases
- Failure/rollback notes

## Acceptance

- Dependencies are directional and non-circular
- Contract changes are explicit
- Enough context exists for implementation without full per-file scaffold
