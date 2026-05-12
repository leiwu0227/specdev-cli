# Skill Architecture Redesign: Two-Layer Model with Aligned Frontmatter

## Problem

1. External skills (skills.sh, Claude Code native skills) have no clear coexistence model with SpecDev skills
2. SpecDev skills suffer from context fade in long agent sessions
3. No distinction between workflow/process skills and project-specific tool skills
4. No path toward a future skill hub

## Design

### Two-layer model

**Claude Code layer** (`.claude/skills/`) — domain knowledge that passively informs code writing:
- Installed from skills.sh or written manually
- Auto-discovered by Claude Code and all subagents
- Agent-specific (Claude Code only)
- Examples: react-best-practices, tailwind-patterns, node-conventions

**SpecDev layer** (`.specdev/skills/`) — workflow process and project-specific tooling:
- Portable across agents (Claude Code, Codex CLI, etc.)
- Split into `core/` (managed by SpecDev) and `tools/` (user/hub-owned)
- Examples: implementing, breakdown, perplexity-search, project-test-runner

The two layers are complementary:
- Claude Code skills = "what you should know" (knowledge)
- SpecDev skills = "how you work and what tools you have" (process + tooling)

### Directory structure

```
project/
├── .claude/skills/              # Claude Code native
│   ├── react-best-practices/    # from skills.sh
│   ├── tailwind-patterns/       # from skills.sh
│   └── ...
│
├── .specdev/
│   ├── skills/
│   │   ├── README.md
│   │   ├── core/                # managed by specdev update
│   │   │   ├── brainstorming/
│   │   │   ├── breakdown/
│   │   │   ├── implementing/
│   │   │   ├── knowledge-capture/
│   │   │   ├── review-agent/
│   │   │   ├── orientation/
│   │   │   ├── test-driven-development/
│   │   │   ├── systematic-debugging/
│   │   │   ├── parallel-worktrees/
│   │   │   ├── scaffolding-lite.md
│   │   │   ├── scaffolding-full.md
│   │   │   ├── verification-before-completion.md
│   │   │   └── receiving-code-review.md
│   │   └── tools/               # user-owned, never touched by update
│   │       ├── README.md
│   │       └── (user/hub-added tools)
│   └── ...
```

### Aligned frontmatter

SpecDev SKILL.md files align with Claude Code's frontmatter format. Both systems use `name` and `description`; each ignores fields it does not recognize. This enables skills to move between `.claude/skills/` and `.specdev/skills/` without modification.

**Core skill frontmatter:**

```yaml
---
name: implementing
description: Execute a plan task-by-task with fresh subagents and two-stage review per task

# SpecDev fields
type: core
phase: implement
input: breakdown/plan.md
output: Implemented code, committed per-task
next: knowledge-capture
---
```

**Tool skill frontmatter:**

```yaml
---
name: perplexity-search
description: Search using Perplexity API for technical research

# SpecDev fields
type: tool
---
```

**Dual-use skill** (works in both systems):

```yaml
---
name: perplexity-search
description: Search using Perplexity API for technical research

# Claude Code fields
allowed-tools: Bash
disable-model-invocation: false

# SpecDev fields
type: tool
---
```

**Field ownership:**

| Field | Claude Code | SpecDev |
|---|---|---|
| `name`, `description` | Uses | Uses |
| `allowed-tools`, `context`, `agent`, `model` | Uses | Ignores |
| `disable-model-invocation`, `user-invocable` | Uses | Ignores |
| `type`, `phase`, `input`, `output`, `next` | Ignores | Uses |

### Plan-driven skill injection (solves context fade)

The breakdown phase declares which skills each task needs. The implementing phase reads those declarations and injects skill content into subagent prompts fresh per task.

**Task format in plan.md:**

```markdown
### Task 3: Add API validation

**Skills:** test-driven-development, perplexity-search
**Files:**
- Modify: `src/api/validator.ts`
- Test: `tests/api/validator.test.ts`

**Step 1: Write the failing test**
...
```

**Changes required:**

1. **Breakdown skill** — new rule: for each task, analyze which skills from `core/` or `tools/` are needed and write a `Skills:` field
2. **`extract-tasks.sh`** — parse the `Skills:` field into the task JSON output
3. **Implementer prompt** — add a `{TASK_SKILLS}` section populated with actual SKILL.md content of declared skills before dispatch

**Flow:**

```
Breakdown phase                 Implementing phase
───────────────                 ──────────────────
Analyze design ──► Per task:    Read task ──► Load declared skills
Identify skills    write        ──► Inject into subagent prompt
needed per task    Skills:      ──► Subagent works with full context
```

### Update behavior

- `specdev update` overwrites `skills/core/` freely — these are SpecDev-managed
- `specdev update` never touches `skills/tools/` — these are user-owned
- Future: `specdev pull <skill-name>` adds to `tools/` from a hub

### Tool skill structure

Tool skills follow the same directory structure as core skills but are typically simpler (no prompts, no phase orchestration):

```
tools/perplexity-search/
├── SKILL.md           # When/how to use, with aligned frontmatter
└── scripts/
    └── search.sh      # Calls Perplexity API
```

## Files to change

1. Move all existing skills from `skills/` to `skills/core/`
2. Create `skills/tools/` with README
3. Update `skills/README.md` to document both categories
4. Update `_router.md` — all skill paths change to `skills/core/...`
5. Update `_main.md` — document the two categories
6. Update `_guides/` — any references to skill paths
7. Update all SKILL.md frontmatter to aligned format (add `type`, `phase`, `input`, `output`, `next` where applicable)
8. Update `breakdown/SKILL.md` — add rule for declaring `Skills:` per task
9. Update `implementing/scripts/extract-tasks.sh` — parse `Skills:` field
10. Update `implementing/prompts/implementer.md` — add `{TASK_SKILLS}` section
11. Update `implementing/SKILL.md` — document skill injection in dispatch process
12. Update `src/` init and update commands — handle `core/` vs `tools/` split
