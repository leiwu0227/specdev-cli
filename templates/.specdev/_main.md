# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. Skills are manuals that teach you when and how to use scripts (deterministic tools). You are the brain.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `state/assignments/` for active work (or `assignments/` in older projects)
3. List available skills: look in `skills/` for folders containing `SKILL.md`
4. Each skill has a **Contract** section that tells you: Input → Process → Output → Next skill

## How Skills Work

```
skills/<name>/
  SKILL.md        ← read this: it's the manual
  scripts/        ← run these: they're deterministic tools
  docs/           ← reference material
  prompts/        ← subagent templates
```

- **Read SKILL.md** to learn when and how to use a skill
- **Run scripts** for reliable, deterministic operations (state management, validation, scaffolding)
- Scripts accept arguments, write JSON/markdown output, and manage state files
- You focus on reasoning and decisions; scripts handle mechanical tasks

## Assignment Flow

1. **Understand** — Run the planning skill's `get-project-context.sh`, ask questions one at a time
2. **Plan** — Use the planning skill to create a self-executing plan document
3. **Execute** — Follow the plan's header instruction (it tells you which skill to use)
4. **Verify** — Use verification skill scripts to confirm completion
5. **Capture** — Distill learnings into `knowledge/` for future reference

## Rules That Always Apply

- Read always-apply skills (verification-before-completion, receiving-code-review) at start of work
- No completion claims without running verification scripts and confirming output
- No performative agreement in reviews — verify technically before accepting
- Every skill produces an artifact (document, state file, or report)
- Scripts handle polling, state transitions, and validation — don't do these manually
