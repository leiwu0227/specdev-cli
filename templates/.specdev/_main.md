# SpecDev Workflow

> **Quick ref:** 5 phases (brainstorm → breakdown → implement → verify → capture).
> TDD always. No completion claims without evidence. Announce subtasks with
> "Specdev: <action>". Check your current assignment phase if unsure what to do next.

You are working in a project that uses SpecDev — a spec-driven development framework with a 5-phase workflow.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `assignments/` for active work
3. If assignments use legacy root files, run `specdev migrate`
4. Use the quick router below to choose the phase

### Quick Router

- Starting from an idea or rough request -> **Brainstorm**
- Have approved design, need executable tasks -> **Breakdown**
- Have plan, need to build -> **Implement**
- Need holistic review in a separate session -> **Verify**
- Implementation done and approved, capture learnings -> **Capture**

## The 5 Phases

1. **Brainstorm** — Interactive Q&A → validated design (`brainstorm/proposal.md` + `brainstorm/design.md`)
2. **Breakdown** — Automatic → detailed executable plan (`breakdown/plan.md`)
3. **Implement** — Automatic → subagent per task, TDD, single review subagent per task (spec + quality)
4. **Verify** — Optional `specdev review implementation` for manual review after implementation
5. **Capture** — Automatic → two diff files (project notes gaps + workflow observations)

## Automatic Flow

After brainstorm design is approved by the user, the remaining phases flow automatically:
- **Breakdown** runs inline subagent review (1-2 rounds) on the plan, then runs `specdev implement` immediately
- **Implement** dispatches a subagent per task, then one reviewer covering spec compliance and code quality
- No approval gates between breakdown and implement — do NOT wait for `specdev review`

## Manual Review (optional)

User can run `specdev review brainstorm` or `specdev review implementation` in a separate session for holistic review. This is never required between breakdown and implement. Main agent uses `specdev check-review` to read and address findings.

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
  review_request.json / review_report.md
```

## Rules That Always Apply

- No completion claims without evidence
- No performative agreement in reviews — verify technically before accepting
- Every phase produces an artifact
- Scripts handle state and validation — don't do these manually
- Per-task reviews use subagents. Holistic reviews happen inline or via `specdev review <phase>`.
