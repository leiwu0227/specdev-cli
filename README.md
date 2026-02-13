# SpecDev CLI

Spec-driven workflow guidance for coding agents. Enforces TDD discipline, complexity-scaled scaffolding, and two-stage code review through modular skills.

```mermaid
graph LR
    A[Assignment] --> P[Plan + Complexity Gate]
    P --> S[Skills]
    S --> I[Implement via TDD]
    I --> V[Two-Stage Review]
    V --> K[Knowledge]
```

## Quick Start

```bash
npm install -g github:leiwu0227/specdev-cli
specdev init
```

After setup, ask your coding agent to read `.specdev/_main.md`.

## Commands

```bash
specdev init              # Initialize .specdev in current directory
specdev update            # Update system files, preserve project files
specdev skills            # List available skills
specdev ponder workflow   # Review assignments, write workflow observations
specdev ponder project    # Review assignments, write project knowledge
specdev help
specdev --version
```

## What gets created

```text
.specdev/
├── _main.md                  # Workflow entry point
├── _router.md                # Routes to correct guide
├── _guides/                  # Workflow and task guides
├── _templates/               # Templates and worked examples
├── skills/
│   ├── core/                 # Core workflow skills (managed by specdev update)
│   └── tools/                # Project tool skills (user-owned)
├── knowledge/                # Long-term project knowledge
├── project_notes/            # Project context and progress
├── project_scaffolding/      # Source mirror metadata
└── assignments/              # Active work
```

## Workflow model

All work happens through assignments in `.specdev/assignments/#####_type_name/`.

### Default flow

1. **Proposal** -- user defines scope
2. **Plan** -- includes complexity/risk gate and TDD task decomposition
3. **Architecture prep** -- conditional scaffolding based on complexity
4. **Implement** -- TDD Red-Green-Refactor per task (optionally via subagent dispatch)
5. **Validate** -- two-stage review (spec compliance, then code quality) with verification evidence
6. **Finalize** -- documentation and assignment status
7. **Knowledge capture** -- distill learnings into `knowledge/` branches

### Complexity gate

Planning classifies each assignment:

| Class | Scaffolding | Gate 1 |
|-------|-------------|--------|
| `LOW` | None | Skip |
| `MEDIUM` | `skills/core/scaffolding-lite.md` (contracts + dependency map) | User approves contracts |
| `HIGH` | `skills/core/scaffolding-full.md` (full per-file blueprints) | User approves full architecture |

### Skills model

Skills are modular capabilities in `.specdev/skills/`, split into two categories:

**Core skills** (`skills/core/`) — managed by SpecDev, updated by `specdev update`. Two sub-categories:

**Always-apply** (read at assignment start, follow throughout):
- `verification-before-completion.md` -- no completion claims without command evidence
- `receiving-code-review.md` -- evidence-based review response, no performative agreement

**Invoke-when-needed** (triggered by complexity gate or conditions):
- `scaffolding-lite.md` / `scaffolding-full.md` -- architecture prep
- `systematic-debugging.md` -- root-cause-first bugfix
- `requesting-code-review.md` -- standardized review packets
- `parallel-worktrees.md` -- safe parallel execution
- `micro-task-planning.md` -- ultra-granular planning for high-risk tasks
- `subagent-driven-development.md` -- fresh subagent per task with two-stage review loop

**Tool skills** (`skills/tools/`) — user-owned, never touched by update:
- Project-specific tools, testing scripts, search integrations
- Future: pulled from a SpecDev skill hub based on project type

Each invoked skill must produce an artifact and be logged in `skills_invoked.md`.

### TDD enforcement

The implementing guide enforces strict test-driven development adapted from [superpowers](https://github.com/obra/superpowers):
- Iron law: no production code without a failing test first
- Red-Green-Refactor cycle with mandatory verification at each phase
- 11-entry rationalization table countering common excuses
- 13-item red flags checklist

### Subagent-driven development

For plans with multiple independent tasks, the `subagent-driven-development` skill dispatches a fresh subagent per task with curated context (full task text copied into prompt, never file references). Each task goes through: implement with TDD, spec compliance review, code quality review, with review loops until both reviewers approve. Adapted from [superpowers](https://github.com/obra/superpowers).

### Two-stage review

After implementation, two independent reviews run in order:
1. **Spec compliance** -- skeptical reviewer verifies implementation matches plan exactly
2. **Code quality** -- issues tagged CRITICAL/IMPORTANT/MINOR with file:line references

### Knowledge capture

After finalize, agents distill learnings into `knowledge/` branches (codestyle, architecture, domain, workflow). Workflow-level observations go to `knowledge/_workflow_feedback/` for cross-project improvement.

## Ponder commands

- `specdev ponder workflow` -- writes workflow-level observations to `knowledge/_workflow_feedback/`
- `specdev ponder project` -- writes project-specific learnings to `knowledge/<branch>/`

## Updating

```bash
npm install -g github:leiwu0227/specdev-cli
specdev update
```

`specdev update` updates system guides/templates and creates missing default skills without overwriting project-specific files or customized skills.

## Acknowledgments

TDD enforcement and verification patterns adapted from [obra/superpowers](https://github.com/obra/superpowers).

## License

MIT
