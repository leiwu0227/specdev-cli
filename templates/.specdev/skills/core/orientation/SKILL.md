---
name: orientation
description: Router — helps you find the right skill for your situation
type: core
---

# Orientation

## Contract

- **Input:** You're starting work and don't know what to do
- **Process:** Assess the situation → route to the right phase
- **Output:** Directs you to the correct skill
- **Next skill:** Whatever matches your situation

## The 5-Phase Workflow

1. **Brainstorm** → `skills/core/brainstorming/SKILL.md` — Interactive design session
2. **Breakdown** → `skills/core/breakdown/SKILL.md` — Design to executable plan (automatic)
3. **Implement** → `skills/core/implementing/SKILL.md` — Subagent per task with review (automatic)
4. **Verify** → `skills/core/review-agent/SKILL.md` — Optional holistic review (separate session, user-initiated)
5. **Capture** → `skills/core/knowledge-capture/SKILL.md` — Write diff files (automatic)

**Important:** Breakdown → Implement is fully automatic. After the inline subagent review approves the plan, run `specdev implement` immediately. Do NOT wait for `specdev review` between these phases.

## Quick Decision Tree

**Starting from scratch with an idea?**
→ Use **brainstorming**

**Have a validated design, need a plan?**
→ Use **breakdown**

**Have a plan, need to implement it?**
→ Use **implementing**

**Need to review someone's work?**
→ Use **review-agent** (launch in separate session)

**Debugging a failing test?**
→ Use **systematic-debugging** (`skills/core/systematic-debugging/SKILL.md`)

**Need parallel task execution?**
→ Use **parallel-worktrees** (`skills/core/parallel-worktrees/SKILL.md`)

**Need a project-specific tool?**
→ Check **skills/tools/** for available tool skills

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/list-skills.sh` | List all available skills | When discovering available skills |

## Two Agents

**Main agent** (your session): brainstorming → breakdown → implementing → knowledge-capture

**Review agent** (separate session): launched by user for holistic phase reviews

The main agent handles everything except holistic review. The review agent is launched separately when the user wants phase-level verification.

## Integration

- This skill is the starting point — it routes to everything else
