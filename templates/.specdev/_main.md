# SpecDev Workflow

> **Quick ref:** 5 phases (brainstorm → breakdown → implement → verify → capture).
> TDD always. No completion claims without evidence. Announce subtasks with
> "Using specdev: <action>". Check your current assignment phase if unsure what to do next.

You are working in a project that uses SpecDev — a spec-driven development framework with a 5-phase workflow.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `assignments/` for active work
3. Read `skills/core/orientation/SKILL.md` for the decision tree

## The 5 Phases

1. **Brainstorm** — Interactive Q&A → validated design (`brainstorm/proposal.md` + `design.md`)
2. **Breakdown** — Automatic → detailed executable plan (`breakdown/plan.md`)
3. **Implement** — Automatic → subagent per task, TDD, two-stage subagent review per task
4. **Verify** — Inline user approval after implementation; optional `specdev review` for manual review
5. **Capture** — Automatic → two diff files (project notes gaps + workflow observations)

## Review Flow

**Automatic subagent reviews** run after brainstorm (1 round), breakdown (1-2 rounds), and per-task during implementation (spec + code quality, up to 10 rounds each).

**Inline user approval** is requested in chat at key gates (after brainstorm design, after all tasks complete).

**Manual review** (optional): User can run `specdev review` in a separate session for phase-aware holistic review.

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
  review/         ← review-feedback.md (if manual review used)
```

## Rules That Always Apply

- No completion claims without evidence
- No performative agreement in reviews — verify technically before accepting
- Every phase produces an artifact
- Scripts handle state and validation — don't do these manually
- Per-task reviews use subagents (spec then quality). Holistic reviews happen inline or via `specdev review`.
