# Specdev v2: Agent-Agnostic Workflow Framework

> **Goal:** Replace superpowers with a platform-agnostic framework where scripts enforce determinism, markdown provides guidance, and any coding agent acts as the brain.

## Core Principles

1. **Scripts are tools** — Deterministic, executable, reliable for state management, polling, verification
2. **Markdown files are manuals** — Teach agents when/how/why to use the tools
3. **Agents are brains** — Read the manual, pick the tool, interpret results
4. **Documents carry instructions** — Output of one skill is self-executing input for the next; no agent context required for handoff
5. **Platform-agnostic** — Core system works with any coding agent; platform-specific features are optional enhancements

## Architecture

### Three Layers

```
Platform adapter (CLAUDE.md / AGENTS.md / .cursor/rules)
    ↓ one-liner pointing to .specdev/_main.md
Skill system (.specdev/skills/)
    ↕ scripts read/write
State & Knowledge (.specdev/state/ + .specdev/knowledge/)
```

### Directory Structure

```
.specdev/
  _main.md                    # Router: "start here if unsure which skill to use"
  skills/                     # HOW to work
    planning/
      SKILL.md                #   manual
      scripts/                #   tools (deterministic executables)
        validate-plan.sh
        scaffold-plan.sh
        register-assignment.sh
        get-project-context.sh
      docs/                   #   supporting reference
        question-patterns.md
      prompts/                #   subagent templates
        reviewer.md
    brainstorming/
      SKILL.md
      scripts/
      docs/
    executing/
      SKILL.md
      scripts/
      prompts/
    ...
  state/                      # WHAT you're working on (ephemeral, per-assignment)
    assignments/              #   active work tracking
      00001_feat_planning/
        proposal.md
        plan.md
        progress.json
        review_request.json
        review_report.md
    progress/                 #   checkpoint files, review status
  knowledge/                  # WHAT you know (persistent, compounds over time)
    project/                  #   architecture, codestyle, domain
    workflow/                 #   cross-project specdev improvements
```

### Skill Folder Structure

```
skills/<skill-name>/
  SKILL.md              # Manual: purpose, contract, process, integration
  scripts/              # Tools: deterministic executables
    script-1.sh
    script-2.sh
  docs/                 # Supporting reference material
    technique.md
  prompts/              # Subagent prompt templates
    implementer.md
    reviewer.md
```

## Skill Contract

Every SKILL.md starts with a clear contract:

```markdown
---
name: planning
description: Interactive design-to-plan workflow
---

# Planning

## Contract
- **Input:** A goal or feature request (from user or assignment)
- **Process:** Question-by-question refinement -> approach selection -> design -> plan
- **Output:** `docs/plans/YYYY-MM-DD-<name>.md` -- a self-executing plan document
- **Next skill:** Plan header tells the executing agent which skill to use

## Scripts
- `scripts/validate-plan.sh` -- Verify plan completeness
- `scripts/scaffold-plan.sh` -- Generate plan template with proper header
- `scripts/register-assignment.sh` -- Create assignment entry in state/
- `scripts/get-project-context.sh` -- Scan repo, knowledge, recent commits
```

Output of one skill becomes input of the next. Documents carry instructions, not agent memory.

## Script Contract

All scripts follow a uniform contract:

- Accept arguments or stdin
- Write structured output to stdout (JSON for data, markdown for reports)
- Write state changes to files under `state/`
- Exit code 0 for success, non-zero for failure
- No interactive prompts -- agents invoke them, scripts just execute

This enables multi-agent, multi-platform collaboration:

```
Claude agent runs:   scripts/request-review.sh --gate=3
  -> writes state/assignments/current/review_request.json

Codex agent runs:    scripts/poll-review.sh
  -> reads the JSON, returns status

Gemini agent runs:   scripts/checkpoint.sh --save
  -> persists progress for any agent to resume
```

## Skill Inventory (14 Skills)

### Design Phase
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `brainstorming` | Question-by-question idea refinement -> design doc | `get-project-context.sh` |
| `planning` | Design doc -> self-executing plan with bite-sized tasks | `validate-plan.sh`, `scaffold-plan.sh`, `register-assignment.sh` |

### Execution Phase
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `executing` | Pick up a plan, execute tasks sequentially with TDD | `get-assignment-context.sh`, `update-status.sh` |
| `subagent-dispatch` | Controller dispatches fresh subagent per task + two-stage review | `checkpoint.sh` |
| `test-driven-development` | Iron law: no production code without failing test first | `verify-tests.sh` |

### Quality Phase
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `verification` | Deterministic "is it actually done?" checks | `verify-gates.sh`, `verify-tests.sh` |
| `spec-review` | Does implementation match the plan exactly? | `get-assignment-context.sh` |
| `code-review` | Code quality (CRITICAL/IMPORTANT/MINOR) | (uses spec-review scripts) |
| `systematic-debugging` | Root cause first, then fix | `verify-tests.sh` |

### Collaboration Phase
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `gate-coordination` | Script-driven gate polling, multi-agent handoff | `request-review.sh`, `poll-review.sh` |
| `parallel-worktrees` | Git worktree setup for isolated work | `setup-worktree.sh` |

### Knowledge Phase
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `knowledge-capture-project` | Distill project-specific learnings (codestyle, architecture, domain) | `scan-assignment.sh` |
| `knowledge-capture-specdev` | Meta-observations about workflow, new skill ideas | `scan-assignment.sh` |

### Meta
| Skill | Purpose | Key Scripts |
|-------|---------|-------------|
| `orientation` | Router: helps agent find the right skill | `list-skills.sh` |

## Planning Skill (Detailed)

Highest priority skill. Turns a vague idea into a self-executing plan.

### Flow

```
Phase 1: Understand (question-by-question)
  - Script: get-project-context.sh -> feeds agent current state/knowledge
  - Agent asks ONE question at a time, multiple choice preferred
  - Agent builds understanding incrementally

Phase 2: Explore approaches
  - Agent proposes 2-3 approaches with trade-offs
  - Leads with recommendation
  - User picks direction

Phase 3: Design (section-by-section)
  - Agent presents design in 200-300 word chunks
  - Checks "does this look right?" after each section
  - Script: scaffold-plan.sh -> creates plan file with proper header

Phase 4: Detail the plan
  - Agent fills in bite-sized tasks (2-5 min each)
  - Exact file paths, complete code, test commands, expected output
  - Script: validate-plan.sh -> checks completeness

Phase 5: Handoff
  - Plan header contains self-executing instruction
  - Agent offers: execute now (subagent) or later (new session)
  - Script: register-assignment.sh -> creates state/assignments entry
```

### Plan Document Format

```markdown
# [Feature Name] Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]

---

### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**
[Complete code]

**Step 2: Run test to verify it fails**
Run: `exact command`
Expected: FAIL with "specific error"

**Step 3: Write minimal implementation**
[Complete code]

**Step 4: Run test to verify it passes**
Run: `exact command`
Expected: PASS

**Step 5: Commit**
[Exact git commands]
```

## Platform Integration

### Detection and Generation

```bash
specdev init                        # auto-detect platform
specdev init --platform=claude      # explicit
specdev init --platform=codex
specdev init --platform=cursor
specdev init --platform=claude --hooks   # opt-in platform enhancements
```

### Generated Files

| Platform | File | Content |
|----------|------|---------|
| Claude Code | `CLAUDE.md` | One-liner: "Read `.specdev/_main.md` before starting any task" |
| Codex | `AGENTS.md` | Same one-liner, Codex format |
| Cursor | `.cursor/rules` | Same, Cursor format |
| Generic | `AGENTS.md` | Fallback for unknown platforms |

### Key Rule

Everything in `.specdev/` is platform-agnostic. Platform-specific files live outside `.specdev/` and just point into it. Optional hooks/plugins for platforms that support them (e.g., Claude Code hooks) are opt-in via `--hooks` flag.

## Shared Script Library

Scripts that multiple skills depend on:

### State Management
- `get-current-assignment.sh` -- Resolve the active assignment, return its path
- `register-assignment.sh` -- Create a new assignment entry in `state/`
- `update-status.sh` -- Transition assignment status (planning -> executing -> reviewing -> done)

### Verification
- `validate-plan.sh` -- Check plan completeness (every task has files, code, tests, commands)
- `verify-tests.sh` -- Run tests, parse output, return structured pass/fail JSON
- `verify-gates.sh` -- Check all gate conditions are met before proceeding

### Coordination
- `request-review.sh` -- Write review request file, set status to pending
- `poll-review.sh` -- Check review status, return result (single check, no loop)
- `checkpoint.sh` -- Save/restore progress for interrupted work

### Context
- `get-project-context.sh` -- Scan repo, recent commits, knowledge files -> summary
- `get-assignment-context.sh` -- Current assignment state, decisions, progress

## State vs Knowledge

**State is ephemeral** -- lives under `state/`, scoped to a single assignment, can be archived when work is done.

**Knowledge is persistent** -- lives under `knowledge/`, compounds across assignments:
- `knowledge/project/` -- Architecture patterns, codestyle conventions, domain knowledge. Stays with the project.
- `knowledge/workflow/` -- Meta-observations about specdev itself: what skills worked, what was missing, new skill ideas. Can feed back upstream.

Skills produce and consume state. Knowledge-capture skills distill state into knowledge.

## Migration Strategy

**Parallel prototype approach:**

1. Build the planning skill end-to-end (SKILL.md + scripts + state integration + platform adapter)
2. Validate the scripts-as-tools model works in practice
3. Once proven, use as template for migrating remaining skills
4. Current v0.0.x continues working during transition

This validates the architecture with the highest-priority skill before committing to a full rewrite.

## Comparison: Specdev v2 vs Superpowers

| Dimension | Superpowers | Specdev v2 |
|-----------|-------------|------------|
| Platform | Claude Code only | Any coding agent |
| Skill invocation | Platform hooks (automatic) | Document pointers (universal) |
| Determinism | Agent-driven (unreliable) | Script-driven (reliable) |
| Multi-agent | Single agent per session | Cross-agent via file protocol |
| Knowledge capture | Not included | Core feature (project + specdev) |
| Complexity gating | Implicit | Explicit (LOW/MEDIUM/HIGH) |
| Assignment tracking | Implicit in plan docs | Structured state system |
| Script tooling | Minimal (find-polluter.sh) | Comprehensive script layer |
