---
name: brainstorming
description: Question-by-question idea refinement before planning
---

# Brainstorming

## Contract

- **Input:** A vague idea, feature wish, or problem statement
- **Process:** Context gathering → diverge (one question at a time) → generate options (2-3 approaches) → converge (pick direction)
- **Output:** A design brief — clear enough to hand off to the planning skill
- **Next skill:** planning

## Scripts

This skill has no scripts of its own. It references:

| Script | Source | When to run |
|--------|--------|-------------|
| `planning/scripts/get-project-context.sh` | planning skill | At the start, to understand current project state |

## Process

### Phase 1: Context Gathering

1. Run `planning/scripts/get-project-context.sh <project-root>` to understand the project
2. Read the output — it tells you about repo structure, recent work, existing knowledge
3. Use this context to ask informed questions

### Phase 2: Diverge

Explore the idea space — one question at a time.

1. Ask the user ONE question to understand their idea better
2. Wait for the answer before asking the next question
3. Keep questions focused: what problem are you solving? who is the user? what constraints exist?
4. Continue until you understand: purpose, constraints, success criteria, scope
5. Do NOT jump to solutions yet

**Rules:**
- Only ONE question per message
- Multiple choice is easier to answer than open-ended — prefer it
- If a topic needs more exploration, break it into multiple questions
- Acknowledge each answer before asking the next question

### Phase 3: Generate Options

Once the problem is clear, propose approaches.

1. Present 2-3 different approaches with clear trade-offs
2. Lead with your recommended approach and explain why
3. Each approach should include: description, pros, cons, rough effort estimate
4. Keep it conversational — this is a discussion, not a presentation

### Phase 4: Converge

Pick a direction together.

1. Let the user choose an approach (or combine elements)
2. Confirm the chosen direction: "So we're going with [approach] because [reasons]"
3. Identify any open questions that remain
4. Resolve open questions one at a time

### Phase 5: Handoff

Package the decision into a design brief for planning.

1. Summarize the design brief:
   - **Goal:** What we're building and why
   - **Approach:** The chosen approach
   - **Constraints:** Known limits and requirements
   - **Success criteria:** How we'll know it works
   - **Open items:** Anything the planning skill needs to resolve
2. Offer to proceed to planning:

> Design brief ready. Want to proceed to the **planning** skill to turn this into an executable plan?

## Red Flags

- Committing to an approach too early — diverge before converging
- Skipping context gathering — you need to know what exists before brainstorming
- Asking multiple questions at once — one question per message, always
- Jumping to implementation details — stay at the design level
- Presenting only one option — always show 2-3 approaches with trade-offs

## Integration

- **Before this skill:** orientation (if unsure whether brainstorming is needed)
- **After this skill:** planning (to turn the design brief into an executable plan)
- **Not needed if:** The user already has a clear, specific request — go straight to planning
