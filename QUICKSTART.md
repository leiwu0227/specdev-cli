# Quick Start

Get up and running with SpecDev in under 5 minutes. By the end of this guide, you'll have SpecDev installed, your project configured, and your first feature moving through the workflow.

## Step 1: Install SpecDev

```bash
npm install -g github:leiwu0227/specdev-cli
```

## Step 2: Set up your project

Navigate to your project and initialize SpecDev:

```bash
cd your-project
specdev init
```

This sets up everything you need:
- `.specdev/` — the workflow folder with skills, templates, and assignment tracking
- `.claude/skills/` — slash-command skills for your coding agent
- Platform adapters (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`) so your agent knows how to use SpecDev

## Step 3: Tell SpecDev about your project

Open your coding agent (e.g. Claude Code) and run:

```bash
specdev start
```

The agent will ask you a few questions about your project — what it does, its tech stack, and key conventions. This context is stored in `.specdev/project_notes/big_picture.md` and is used by every subsequent command to give relevant guidance.

## Step 4: Start your first feature

Still inside your coding agent, create an assignment:

```bash
specdev assignment my-feature
```

Replace `my-feature` with a short name for what you're building (e.g. `auth`, `search`, `dashboard`). This kicks off the 5-phase workflow described below.

## The 5-Phase Workflow

Every assignment moves through these phases in order. Each command checks that the previous phase is complete before letting you proceed — no skipping ahead.

### Phase 1: Brainstorm

```bash
specdev assignment my-feature
```

Interactive Q&A with you to nail down scope and design. The agent asks one question at a time, and design sections are validated incrementally.

**Produces:** `brainstorm/proposal.md` + `brainstorm/design.md`

**Review after brainstorm:** Once the design is written, you have two options:
- Say **`auto review`** — a 1-round subagent review checks the design automatically, then breakdown begins.
- Run **`specdev review brainstorm`** in a separate session — an independent review checks completeness, feasibility, edge cases, and scope. You can address feedback before moving on.

**Need to revise?** If a later phase reveals a design problem, run `specdev revise` to archive downstream artifacts and re-enter brainstorming with your existing design loaded as context.

### Phase 2: Breakdown

```bash
specdev breakdown
```

Automatically decomposes the design into small, executable TDD tasks. Each task is self-contained with exact file paths, code snippets, and test commands. An automatic 1-2 round subagent review validates the plan before it's finalized.

**Produces:** `breakdown/plan.md`

### Phase 3: Implement

```bash
specdev implement
```

Dispatches a fresh subagent per task. Each follows strict TDD (Red → Green → Refactor). Every task goes through **two automatic per-task reviews** before it's considered done:

1. **Spec review** — does the task implementation match what was specified in the plan?
2. **Code quality review** — is the code clean, well-tested, and following project conventions?

After all tasks complete, the agent runs the full test suite, presents a summary of what was built, and asks for your approval.

**Produces:** committed code + `implementation/progress.json`

### Phase 4: Verify (holistic review)

```bash
specdev review implementation
```

This is a **separate, top-down review** of the entire implementation — distinct from the per-task reviews that happened during Phase 3. Run it in the same session or open a separate one.

The review agent checks:
- **Design match** — does the full implementation match the original design?
- **Integration** — do all components work together without conflicts?
- **Test coverage** — are all behaviors tested? Any gaps?
- **Scope** — was anything built that wasn't in the design? Anything missing?

Up to 3 review rounds. After each round, findings are written to `review_report.md` and tagged as CRITICAL or MINOR. You mediate between the reviewer and the main agent to address issues.

**Produces:** `review_report.md`

### Phase 5: Capture

Runs automatically after the assignment is complete. Distills learnings into workflow observations and documentation gaps for future reference.

## Lost? Check your status

At any point, run:

```bash
specdev continue
```

This tells you exactly where you are, what's blocking you, and what to do next. Works from the terminal or inside an agent session.

## Command reference

| Command | Run from | What it does |
|---|---|---|
| `specdev init` | Terminal | Set up `.specdev/`, install skills and platform adapter |
| `specdev update` | Terminal | Refresh core skills, keep your project files |
| `specdev skills` | Terminal | List available skills |
| `specdev help` | Terminal | Show usage info |
| `specdev start` | Either | Fill in or check project context |
| `specdev continue` | Either | Show current state, blockers, and next action |
| `specdev assignment <name>` | Coding agent | Create an assignment and start brainstorming |
| `specdev breakdown` | Coding agent | Turn the design into a task plan |
| `specdev implement` | Coding agent | Execute the plan (TDD, one subagent per task) |
| `specdev revise` | Coding agent | Archive downstream artifacts, re-enter brainstorm |
| `specdev review <phase>` | Either | Run manual review (`brainstorm` or `implementation`) |
| `specdev ponder workflow` | Terminal | Review and accept/reject workflow observations |
| `specdev ponder project` | Terminal | Review and accept/reject project learnings |
| `specdev migrate` | Terminal | Convert legacy assignments to V4 layout |

## Putting it all together

```
Terminal:  specdev init                        # one-time setup
Agent:     specdev start                      # describe your project
Agent:     specdev assignment my-feature      # brainstorm → design.md
                                              # review (auto or specdev review brainstorm)
Agent:     specdev breakdown                  # design.md → plan.md (auto-reviewed)
Agent:     specdev implement                  # plan.md → committed code
                                              # (per-task spec + code quality reviews)
Agent:     specdev review implementation      # holistic review of full implementation
Agent:     specdev revise                     # (if needed) archive artifacts, revise design
```
