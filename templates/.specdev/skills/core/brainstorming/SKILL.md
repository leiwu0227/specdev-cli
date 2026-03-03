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

**Question categories to cover** (not a rigid script — guide the conversation through these topics as relevant):

| Category | Core? | What to learn |
|----------|-------|---------------|
| Problem/goal | Always | What are we solving and why? |
| Scope boundaries | Always | What should this NOT do? |
| Success criteria | Always | How do we verify it works? |
| Target users/callers | When relevant | Who uses this? |
| Edge cases | When relevant | What could go wrong? |
| Dependencies | When relevant | What does this touch or rely on? |
| Existing patterns | When relevant | How does the codebase handle similar things? |
| Testing approach | When relevant | How will this be tested? |

### Phase 2: Explore Approaches

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design Sections

Present the design incrementally for validation. Use `_templates/brainstorm-design.md` as a starting point.

**Scale sections to the assignment type:**

| Type | Required sections |
|------|------------------|
| feature | Overview, Goals, Non-Goals, Design, Success Criteria |
| bugfix | Overview, Root Cause, Fix Design, Success Criteria |
| refactor | Overview, Non-Goals, Design, Success Criteria |
| familiarization | Overview |

You may always add optional sections (User Stories, Dependencies, Risks, Technical Constraints, Testing Approach, Open Questions) when the complexity warrants it.

1. Copy the template, keep sections relevant to the assignment type, remove the rest
2. Present one section at a time (200-300 words each)
3. After each section, ask: "Does this look right so far?"
4. Be ready to revise if something doesn't make sense
5. Record key decisions and their reasoning as you go

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
5. Tell the user: "Run `specdev approve brainstorm` when you're ready to proceed."
6. Stop and wait — do NOT proceed to breakdown until the user has approved

**After stopping**, the user may:
- Review the design themselves and provide feedback
- Run `specdev review brainstorm` in a separate session for an independent review
- Request an automated external review via the **reviewloop** tool skill
- Run `specdev approve brainstorm` to proceed to breakdown

## Red Flags

- Skipping get-project-context.sh — need context before asking questions
- Committing to an approach before exploring alternatives — always show 2-3 options
- Presenting the entire design at once — 200-300 word sections, validate each
- Jumping to implementation details too early — stay at design level during brainstorm
- Missing Non-Goals section for features/refactors — scope boundaries prevent wasted work
- Missing Success Criteria — "how do we know it's done" must be explicit

## Integration

- **After this skill:** breakdown (starts after user runs `specdev approve brainstorm`)
- **Review:** User may run `specdev review brainstorm` before approving
- **Reviewloop:** User may request automated external review (e.g., Codex) via the reviewloop tool skill before approving
