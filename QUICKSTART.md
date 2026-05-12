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
- `.claude/skills/` and `.codex/skills/` — command skills for Claude Code and Codex
- Platform adapters (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`) so your agent knows how to use SpecDev

## Step 3: Tell SpecDev about your project

Open your coding agent (Claude Code or Codex) and run:

```bash
specdev start
```

The agent will ask you a few questions about your project — what it does, its tech stack, and key conventions. This context is stored in `.specdev/project_notes/big_picture.md` and is used by every subsequent command to give relevant guidance.

## Step 4: Start your first feature

Still inside your coding agent, create an assignment:

```bash
specdev assignment "Short description of what you're building"
```

This reserves the next assignment ID and kicks off the 3-phase workflow described below. The canonical entry point for the workflow is `.specdev/_main.md`; this guide is a short orientation.

## The 3-Phase Workflow

Every assignment moves through these phases in order. The CLI enforces gates between phases — no skipping ahead. Knowledge capture at the end of a phase is optional and never blocks progress.

### Phase 1: Brainstorm

```bash
specdev assignment "<description>"
```

Interactive Q&A with you to nail down scope and design. The agent asks questions guided by category (problem/goal, scope boundaries, success criteria, etc.), explores 2-3 approaches, then presents design sections scaled to the assignment type.

**Produces:** `brainstorm/proposal.md` + `brainstorm/design.md`

**Before approving, you can optionally review:**
- `specdev checkpoint brainstorm` — validate required design sections exist
- `specdev review brainstorm` — manual review in a separate session
- `specdev reviewloop brainstorm` — automated review via external CLI (e.g., Codex, Claude)
- `specdev reviewloop brainstorm --reviewer=<name> --autocontinue` — review, then continue after approval

**Need to revise?** If a later phase reveals a design problem, run `specdev revise` to archive downstream artifacts and re-enter brainstorming with your existing design loaded as context.

```bash
specdev approve brainstorm            # Gate: proceed to breakdown + implementation
```

### Phase 2: Breakdown

Runs immediately after brainstorm approval — no separate gate. Decomposes the design into small, executable tasks (H3 `### Task N:` headers inside `breakdown/plan.md`). Each task is self-contained with exact file paths, code snippets, and test commands. An automatic 1-2 round subagent review validates the plan before it's finalized.

**Produces:** `breakdown/plan.md`

### Phase 3: Implement

Implementation begins immediately after breakdown. Tasks are executed in plan order. Each task declares a mode:

- `lightweight` — no TDD, no review (trivial scaffold/config only).
- `standard` (default) — TDD + implementer self-review only.
- `full` — TDD + reviewer subagent dispatched for spec compliance + code quality.

After all tasks complete, the agent runs verification appropriate for the assignment's risk level and presents a summary.

**Produces:** committed code + `implementation/progress.json`

**Before approving, you can optionally review:**
- `specdev checkpoint implementation` — validate implementation artifacts
- `specdev review implementation` — manual review in a separate session
- `specdev reviewloop implementation` — automated review via external CLI
- `specdev reviewloop implementation --reviewer=<name> --autocontinue` — review, then approve after passing

```bash
specdev approve implementation        # Gate: assignment complete
```

### Optional: Knowledge Capture

After a phase completes, if the agent learned something reusable, it may suggest capturing a short note in `.specdev/knowledge/<branch>/` (architecture, codestyle, domain, workflow, or workflow_feedback). This is opportunistic and never blocks progress.

Subsequent assignments find that knowledge via:

```bash
specdev knowledge search "<query>"
```

## Lost? Check your status

At any point, run:

```bash
specdev continue        # human-readable next action
specdev next --json     # canonical machine-readable next action
```

These tell you exactly where you are, what's blocking you, and what to do next. Works from the terminal or inside an agent session.

## Command reference

| Command | Run from | What it does |
|---|---|---|
| `specdev init` | Terminal | Set up `.specdev/`, install skills and platform adapters |
| `specdev update` | Terminal | Refresh core skills, keep your project files |
| `specdev skills` | Terminal | List available skills |
| `specdev help` | Terminal | Show usage info |
| `specdev start` | Either | Fill in or check project context |
| `specdev continue` | Either | Show current state, blockers, and next action |
| `specdev next --json` | Either | Canonical next workflow action (machine-readable) |
| `specdev assignment "<desc>"` | Coding agent | Reserve assignment ID and start brainstorming |
| `specdev discussion "<desc>"` | Coding agent | Start a parallel brainstorming discussion (no gate) |
| `specdev focus <id>` | Either | Switch the active assignment |
| `specdev checkpoint <phase>` | Either | Validate phase artifacts |
| `specdev approve <phase>` | Either | Hard gate: approve phase and proceed |
| `specdev review <phase>` | Separate session | Manual review (`brainstorm` or `implementation`) |
| `specdev reviewloop <phase>` | Coding agent | Automated external review loop |
| `specdev reviewloop <phase> --reviewer=<name> --autocontinue` | Coding agent | Automated review and continue after approval |
| `specdev check-review` | Coding agent | Read and address review feedback |
| `specdev revise` | Coding agent | Archive downstream artifacts, re-enter brainstorm |
| `specdev knowledge index` | Terminal | Build the SQLite knowledge cache |
| `specdev knowledge search "<query>"` | Either | Search indexed knowledge notes |
| `specdev knowledge list` | Either | List all knowledge files with metadata |
| `specdev memory refresh` | Terminal | Regenerate bounded `working_memory.md` for agents |
| `specdev migrate` | Coding agent | Guided `.specdev/` layout migration workflow |
| `specdev migrate legacy-assignments` | Terminal | Mechanical V3→V4 assignment file mover |

## Putting it all together

```
Terminal:  specdev init                        # one-time setup
Agent:     specdev start                       # describe your project
Agent:     specdev assignment "<desc>"         # brainstorm → design.md
           specdev checkpoint brainstorm       # validate design (optional)
           specdev reviewloop brainstorm       # automated review (optional)
           specdev approve brainstorm          # gate → breakdown runs immediately
                                               # breakdown → plan.md (auto-reviewed)
                                               # implement → committed code
           specdev checkpoint implementation   # validate implementation (optional)
           specdev reviewloop implementation   # automated review (optional)
           specdev approve implementation      # gate → assignment complete
                                               # optionally capture knowledge
```
