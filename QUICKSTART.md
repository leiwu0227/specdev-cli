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

Replace `my-feature` with a short name for what you're building (e.g. `auth`, `search`, `dashboard`). This kicks off the 4-phase workflow described below.

## The 4-Phase Workflow

Every assignment moves through these phases in order. The CLI enforces gates between phases — no skipping ahead.

### Phase 1: Brainstorm

```bash
specdev assignment my-feature
```

Interactive Q&A with you to nail down scope and design. The agent asks questions guided by category (problem/goal, scope boundaries, success criteria, etc.), explores 2-3 approaches, then presents design sections scaled to the assignment type.

**Produces:** `brainstorm/proposal.md` + `brainstorm/design.md`

**Before approving, you can optionally review:**
- `specdev checkpoint brainstorm` — validate required design sections exist
- `specdev review brainstorm` — manual review in a separate session
- `specdev reviewloop brainstorm` — automated review via external CLI (e.g., Codex)

**Need to revise?** If a later phase reveals a design problem, run `specdev revise` to archive downstream artifacts and re-enter brainstorming with your existing design loaded as context.

```bash
specdev approve brainstorm            # Gate: proceed to breakdown + implementation
```

### Phase 2: Breakdown (automatic)

Runs automatically after brainstorm approval — no separate command needed. Decomposes the design into small, executable TDD tasks. Each task is self-contained with exact file paths, code snippets, and test commands. An automatic 1-2 round subagent review validates the plan before it's finalized.

**Produces:** `breakdown/plan.md`

### Phase 3: Implement

Implementation begins automatically after breakdown. A fresh subagent is dispatched per task. Each follows strict TDD (Red → Green → Refactor). Every task goes through **two automatic per-task reviews** before it's considered done:

1. **Spec review** — does the task implementation match what was specified in the plan?
2. **Code quality review** — is the code clean, well-tested, and following project conventions?

After all tasks complete, the agent runs the full test suite and presents a summary.

**Produces:** committed code + `implementation/progress.json`

**Before approving, you can optionally review:**
- `specdev checkpoint implementation` — validate implementation artifacts
- `specdev review implementation` — manual review in a separate session
- `specdev reviewloop implementation` — automated review via external CLI (e.g., Codex)

```bash
specdev approve implementation        # Gate: proceed to summary
```

### Phase 4: Summary (automatic)

Runs automatically after implementation approval. The agent captures per-assignment learnings:
- `capture/project-notes-diff.md` — gaps in project documentation
- `capture/workflow-diff.md` — what worked and what didn't

After multiple assignments are complete, you can aggregate learnings across them:

```bash
specdev distill workflow               # aggregate workflow observations
specdev distill project                # aggregate project learnings
```

## Lost? Check your status

At any point, run:

```bash
specdev continue
```

This tells you exactly where you are, what's blocking you, and what to do next. Works from the terminal or inside an agent session.

## Command reference

| Command | Run from | What it does |
|---|---|---|
| `specdev init` | Terminal | Set up `.specdev/`, install skills and platform adapters |
| `specdev update` | Terminal | Refresh core skills, keep your project files |
| `specdev skills` | Terminal | List available skills |
| `specdev help` | Terminal | Show usage info |
| `specdev start` | Either | Fill in or check project context |
| `specdev continue` | Either | Show current state, blockers, and next action |
| `specdev assignment <name>` | Coding agent | Create an assignment and start brainstorming |
| `specdev checkpoint <phase>` | Either | Validate phase artifacts |
| `specdev approve <phase>` | Either | Hard gate: approve phase and proceed |
| `specdev review <phase>` | Separate session | Manual review (`brainstorm` or `implementation`) |
| `specdev reviewloop <phase>` | Coding agent | Automated external review loop |
| `specdev revise` | Coding agent | Archive downstream artifacts, re-enter brainstorm |
| `specdev check-review` | Coding agent | Read and address review feedback |
| `specdev distill workflow` | Terminal | Aggregate workflow observations |
| `specdev distill project` | Terminal | Aggregate project learnings |
| `specdev migrate` | Terminal | Convert legacy assignments to V4 layout |

## Putting it all together

```
Terminal:  specdev init                        # one-time setup
Agent:     specdev start                       # describe your project
Agent:     specdev assignment my-feature       # brainstorm → design.md
           specdev checkpoint brainstorm       # validate design (optional)
           specdev reviewloop brainstorm       # automated review (optional)
           specdev approve brainstorm          # gate → breakdown runs automatically
                                               # breakdown → plan.md (auto-reviewed)
                                               # implement → committed code
                                               # (per-task spec + code quality reviews)
           specdev checkpoint implementation   # validate implementation (optional)
           specdev reviewloop implementation   # automated review (optional)
           specdev approve implementation      # gate → summary runs automatically
                                               # summary → capture learnings

# After multiple assignments:
Terminal:  specdev distill workflow             # aggregate workflow observations
           specdev distill project             # aggregate project learnings
```
