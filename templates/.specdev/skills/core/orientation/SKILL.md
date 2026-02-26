---
name: orientation
description: Router — helps you find the right skill for your situation
type: core
---

# Orientation

## Contract

- **Input:** You need a phase router
- **Process:** Use `_main.md` quick router and phase descriptions
- **Output:** Phase selected
- **Next skill:** Whatever matches your situation

## Router Source

Read `.specdev/_main.md` (from project root) and use:
- `Quick Router`
- `The 5 Phases`
- `Automatic Flow`

This skill intentionally stays thin to avoid duplicating workflow guidance.

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/list-skills.sh` | List all available skills | When discovering available skills |

## Integration

- This is a compatibility entry point
- `_main.md` is the source of truth for workflow routing
