# Scaffolding and Architecture Prep Guide

## Purpose

Provide architecture clarity only when complexity justifies it.

Scaffolding is no longer mandatory for every assignment. Planning decides one of:

- `none`
- `scaffolding-lite`
- `scaffolding-full`

## Decision source

Use the complexity/risk gate in `planning_guide.md`.

## Modes

### Mode A: none (LOW complexity)

No scaffold files required.
Proceed directly to implementation.

### Mode B: scaffolding-lite (MEDIUM complexity)

Invoke `.specdev/skills/scaffolding-lite.md`.

Required artifact:

- `scaffold/_architecture.md` containing module dependency map, contracts, and key edge cases

Gate 1 user approval required before implementation (approve contracts and interfaces).

### Mode C: scaffolding-full (HIGH complexity)

Invoke `.specdev/skills/scaffolding-full.md`.

Required artifacts:

- One scaffold doc per source file (`scaffold/*.md`)
- `scaffold/_architecture.md`
- Gate 1 user approval before implementation

## File mapping rules (full mode)

- One scaffolding document per source file
- Skip tests/config/docs/data files
- Order by dependency direction (utility -> core -> business -> interface)

## Quality checklist

- [ ] Mode selected from complexity gate
- [ ] Mode rationale documented in `plan.md`
- [ ] Skill invocation logged in `skills_invoked.md`
- [ ] Required artifact(s) produced
- [ ] Dependencies and edge cases are explicit
- [ ] Gate 1 approval recorded if lite or full mode
