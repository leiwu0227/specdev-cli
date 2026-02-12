---
name: planning
description: Interactive design-to-plan workflow — turns ideas into self-executing plans
---

# Planning

## Contract

- **Input:** A goal, feature request, or assignment proposal
- **Process:** Question-by-question refinement → approach exploration → section-by-section design → detailed plan
- **Output:** `docs/plans/YYYY-MM-DD-<name>.md` — a self-executing plan document
- **Next skill:** Plan header tells the executing agent which skill to use (executing or subagent-dispatch)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-project-context.sh` | Scan repo structure, recent commits, knowledge files → context summary | At the start, before asking questions |
| `scripts/scaffold-plan.sh` | Generate plan file with proper header and task template | After design is validated, before detailing tasks |
| `scripts/validate-plan.sh` | Check plan completeness — every task has files, code, tests, commands | After writing all tasks, before handoff |
| `scripts/register-assignment.sh` | Create assignment entry in state/, link plan | After plan is validated |

## Process

### Phase 1: Understand

Get context first, then ask questions one at a time.

1. Run `scripts/get-project-context.sh <project-root>` to get current state
2. Read the output — it tells you about the repo, recent work, and existing knowledge
3. Ask the user ONE question at a time to understand their goal
4. Prefer multiple-choice questions when possible
5. Continue until you understand: purpose, constraints, success criteria

**Rules:**
- Only ONE question per message
- If a topic needs more exploration, break it into multiple questions
- Multiple choice is easier to answer than open-ended — prefer it
- Do not proceed until you understand what you are building

### Phase 2: Explore Approaches

Once you understand the goal, propose options.

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design

Present the design incrementally for validation.

1. Break the design into sections of 200-300 words
2. Present one section at a time
3. After each section, ask: "Does this look right so far?"
4. Cover: architecture, components, data flow, error handling, testing approach
5. Be ready to revise if something doesn't make sense

### Phase 4: Detail the Plan

Turn the validated design into a self-executing plan document.

1. Run `scripts/scaffold-plan.sh <plan-name> <project-root>` to create the plan file
2. Fill in bite-sized tasks (each step is 2-5 minutes of work):
   - "Write the failing test" — one step
   - "Run it to make sure it fails" — one step
   - "Implement the minimal code" — one step
   - "Run the tests" — one step
   - "Commit" — one step
3. Every task MUST include:
   - Exact file paths (create/modify/test)
   - Complete code (not "add validation" — show the actual code)
   - Exact commands to run with expected output
4. Run `scripts/validate-plan.sh <plan-file>` to check completeness
5. Fix any gaps the validator finds

### Phase 5: Handoff

Register the plan and offer execution options.

1. Run `scripts/register-assignment.sh <plan-file> <project-root>` to create the assignment
2. Tell the user:

> Plan complete and saved to `docs/plans/<filename>.md`.
>
> **Two execution options:**
> 1. **Subagent-Driven (this session)** — Fresh subagent per task, review between tasks
> 2. **New Session** — Open new session, agent reads plan header and executes
>
> Which approach?

## Plan Document Format

Every plan MUST start with this header:

    # [Feature Name] Implementation Plan

    > **For agent:** Use specdev:executing skill to implement this plan task-by-task.

    **Goal:** [One sentence]

    **Architecture:** [2-3 sentences about approach]

    **Tech Stack:** [Key technologies/libraries]

    ---

Every task MUST follow this structure:

    ### Task N: [Component Name]

    **Files:**
    - Create: `exact/path/to/file.ext`
    - Modify: `exact/path/to/existing.ext:line-range`
    - Test: `tests/exact/path/to/test.ext`

    **Step 1: Write the failing test**
    [Complete test code]

    **Step 2: Run test to verify it fails**
    Run: `exact command`
    Expected: FAIL with "specific error message"

    **Step 3: Write minimal implementation**
    [Complete implementation code]

    **Step 4: Run test to verify it passes**
    Run: `exact command`
    Expected: PASS

    **Step 5: Commit**
    [Exact git commands with message]

## Red Flags

- Asking multiple questions in one message — STOP, ask one at a time
- Skipping get-project-context.sh — you need context before asking questions
- Writing vague task steps ("add error handling") — be specific, show the code
- Skipping validate-plan.sh — always run it before handoff
- Presenting the entire design at once — break into 200-300 word sections
- Not offering execution options at the end — always present the handoff

## Integration

- **Before this skill:** brainstorming (if the idea needs refinement first)
- **After this skill:** executing or subagent-dispatch (to implement the plan)
- **Always active during this skill:** verification-before-completion (validate plan completeness)
