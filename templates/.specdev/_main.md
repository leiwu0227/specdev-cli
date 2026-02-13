# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework with a 5-phase workflow and 2-agent architecture.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `assignments/` for active work
3. Read `skills/core/orientation/SKILL.md` for the decision tree

## The 5 Phases

1. **Brainstorm** — Interactive Q&A → validated design (`brainstorm/proposal.md` + `design.md`)
2. **Breakdown** — Automatic → detailed executable plan (`breakdown/plan.md`)
3. **Implement** — Automatic → subagent per task, TDD, two-stage review per task
4. **Verify** — Review agent (separate session) → holistic check at phase boundaries
5. **Capture** — Automatic → two diff files (project notes gaps + workflow observations)

## Two Agents

**Main agent** (this session): Handles phases 1-3 and 5. Interactive during brainstorm, automatic after.

**Review agent** (separate session): Handles phase 4. Launched by user for holistic phase reviews. Communicates via signal files in `review/`.

## How Skills Work

Skills live in two directories:

**`skills/core/`** — Workflow skills managed by SpecDev:
```
skills/core/<name>/
  SKILL.md        ← the manual
  scripts/        ← deterministic tools
  prompts/        ← subagent templates
```

**`skills/tools/`** — Project-specific tool skills (user-owned, never overwritten by update):
```
skills/tools/<name>/
  SKILL.md        ← instructions and frontmatter
  scripts/        ← executable tools
```

All skills use aligned frontmatter compatible with Claude Code's skill format.

## Assignment Folder

```
assignments/<id>/
  brainstorm/     ← proposal.md + design.md
  breakdown/      ← plan.md
  implementation/ ← progress.json
  review/         ← signal files (ready-for-review.md, review-feedback.md)
```

## Rules That Always Apply

- No completion claims without evidence
- No performative agreement in reviews — verify technically before accepting
- Every phase produces an artifact
- Scripts handle polling, state, and validation — don't do these manually
- Per-task reviews use subagents (spec then quality). Holistic reviews use the review agent.
