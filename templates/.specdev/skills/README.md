# SpecDev Skills Library

Skills are split into two categories:

## Core Skills (`core/`)

Managed by SpecDev. Updated by `specdev update`. These define the workflow.

### Folder-based skills

**Main agent (phases 1-3, 5):**
- `core/brainstorming/` — Interactive idea-to-design session
- `core/breakdown/` — Turn design into bite-sized executable steps
- `core/implementing/` — Execute plan with subagent dispatch and two-stage review
- `core/knowledge-capture/` — Write diff files after assignment completion

**Review agent (phase 4):**
- `core/review-agent/` — Holistic reviewer with file-based signals

**Supporting:**
- `core/test-driven-development/` — RED-GREEN-REFACTOR with verify-tests.sh
- `core/systematic-debugging/` — Root-cause-first debugging
- `core/parallel-worktrees/` — Git worktree isolation for parallel tasks
- `core/orientation/` — Router and decision tree

### Flat reference skills

**Always-apply:**
- `core/verification-before-completion.md` — No completion claims without evidence
- `core/receiving-code-review.md` — No performative agreement in reviews

**When needed:**
- `core/scaffolding-lite.md` — Lightweight scaffolding (contracts + dependency map)
- `core/scaffolding-full.md` — Full scaffolding (per-file blueprints)

## Tool Skills (`tools/`)

User-owned. Never touched by `specdev update`. Project-specific tools and capabilities.

See `tools/README.md` for how to add tool skills.

## Frontmatter

All skills use YAML frontmatter aligned with the Claude Code skill format:

```yaml
---
name: skill-name
description: What this skill does

# SpecDev fields
type: core       # or: tool
phase: implement # (core skills only) which workflow phase
---
```

## Plan-Driven Skill Injection

The breakdown phase can declare which skills each task needs via a `Skills:` field in plan tasks. The implementing phase reads these declarations and injects skill content into subagent prompts, solving context fade in long sessions.
