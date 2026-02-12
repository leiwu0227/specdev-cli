---
name: orientation
description: Router — helps you find the right skill for your situation
---

# Orientation

## Contract

- **Input:** You're starting work and don't know which skill to use
- **Process:** Assess the situation → match to the right skill
- **Output:** Directs you to the correct skill's SKILL.md
- **Next skill:** Whatever skill matches your situation

## When to Read This

Read this if:
- You just started a session and need to figure out what to do
- You're unsure which skill applies to your current situation
- You want to see what skills are available

## Quick Decision Tree

**Are you starting from scratch with an idea?**
→ Use the **planning** skill

**Do you have a validated plan document?**
→ Use the **executing** skill

**Are you debugging a failing test or unexpected behavior?**
→ Use the **systematic-debugging** skill (flat file: `skills/systematic-debugging.md`)

**Are you reviewing someone else's code?**
→ Read `skills/receiving-code-review.md` (always-apply)

**Are you about to claim work is done?**
→ Read `skills/verification-before-completion.md` (always-apply)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/list-skills.sh` | List all available skills with their contracts | When you need to discover available skills |

## How to Use list-skills.sh

Run: `scripts/list-skills.sh <specdev-path>`

It outputs a summary of every skill: name, type (folder or flat), description, and contract (if available). Use this to quickly find the right skill without reading every SKILL.md.

## Always-Apply Skills

These skills should be read at the start of EVERY work session:

1. **verification-before-completion** (`skills/verification-before-completion.md`) — No completion claims without evidence
2. **receiving-code-review** (`skills/receiving-code-review.md`) — No performative agreement in reviews
