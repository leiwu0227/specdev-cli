---
name: brainstorming
description: Interactive idea-to-design session with collaborative Q&A
type: core
phase: brainstorm
input: User idea or request
output: brainstorm/proposal.md + brainstorm/design.md
next: breakdown
---

# Brainstorming

## Contract

- **Input:** A vague idea, feature wish, bug report, or refactoring goal
- **Process:** Context scan → Q&A (1-3 tightly related questions per message) → explore approaches → present design sections → validate each section
- **Output:** `brainstorm/proposal.md` + `brainstorm/design.md` in the assignment folder
- **Next phase:** breakdown (after user runs `specdev approve brainstorm`)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-project-context.sh` | Scan repo structure, recent commits, knowledge files | At the start, before asking questions |

## Process

### Phase 1: Understand

1. Run `scripts/get-project-context.sh <project-root>` to get current state
2. Read the output — repo structure, recent work, existing knowledge
3. Ask the user 1-3 tightly related questions per message to understand their goal
   - Prefer multiple-choice over open-ended
   - Acknowledge each answer before asking the next question
4. Continue until you understand: purpose, constraints, success criteria
5. Do not proceed until you understand what you are building

### Phase 2: Explore Approaches

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design Sections

Present the design incrementally for validation.

1. Break the design into sections of 200-300 words
2. Present one section at a time
3. After each section, ask: "Does this look right so far?"
4. Cover: architecture, components, data flow, error handling, testing approach
5. Be ready to revise if something doesn't make sense
6. Record key decisions and their reasoning as you go

### Phase 4: Write to Assignment

Once all design sections are validated:

1. Create the assignment folder (use register-assignment pattern)
2. Write `brainstorm/proposal.md` — short (1-2 paragraphs), what and why
3. Write `brainstorm/design.md` — full validated design including:
   - Goal and approach
   - Architecture and components
   - Key decisions with reasoning
   - Success criteria
   - Testing approach
4. Announce: "Brainstorm complete. Design written to assignment folder."
5. Stop and wait for user

**After stopping**, the user may:
- Review the design themselves and provide feedback
- Run `specdev review brainstorm` in a separate session for an independent review
- Run `specdev approve brainstorm` to proceed — a subagent review (1 round) checks the design, then breakdown begins automatically

## Red Flags

- Skipping get-project-context.sh — need context before asking questions
- Committing to an approach before exploring alternatives — always show 2-3 options
- Presenting the entire design at once — 200-300 word sections, validate each
- Jumping to implementation details too early — stay at design level during brainstorm

## Integration

- **After this skill:** breakdown (auto-chains after `specdev approve brainstorm`)
- **Review:** User may run `specdev review brainstorm` before approving
