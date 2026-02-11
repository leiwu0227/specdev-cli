# Feature Descriptions

Running catalog of completed assignments. See `.specdev/_guides/task/validation_guide.md` (Gate 5) for update instructions.

---

## Features

### CLI Commands (v0.0.4)

| Command | Module | Description |
|---------|--------|-------------|
| `specdev init` | `src/commands/init.js` | Scaffold `.specdev/` from templates into a project. Supports `--target`, `--force`, `--dry-run` |
| `specdev update` | `src/commands/update.js` | Selectively update system files while preserving project content |
| `specdev skills` | `src/commands/skills.js` | List available skills in the current project's `.specdev/skills/` |
| `specdev ponder workflow` | `src/commands/ponder-workflow.js` | Interactive session to capture workflow-level observations |
| `specdev ponder project` | `src/commands/ponder-project.js` | Interactive session to capture project knowledge across 4 branches |
| `specdev help` / `--version` | `src/commands/help.js` | Display usage info and version |

### Skills Library (8 skills)

**Always-apply (mandatory on every assignment):**
- `verification-before-completion.md` — Gate function with rationalization table
- `receiving-code-review.md` — Anti-sycophancy protocol, evidence-based review

**Invoke-when-needed:**
- `scaffolding-lite.md` / `scaffolding-full.md` — Complexity-driven architecture prep
- `systematic-debugging.md` — Root-cause-first debugging
- `requesting-code-review.md` — Standardized review packet format
- `parallel-worktrees.md` — Safe parallel execution
- `micro-task-planning.md` — Ultra-granular planning
- `subagent-driven-development.md` — Fresh subagent per task with two-stage review loop

### Knowledge System

- 4-branch vault: `codestyle/`, `architecture/`, `domain/`, `workflow/`
- `_workflow_feedback/` for cross-project improvement observations
- Auto-generated `_index.md` inventory (respects manual edits)
- Interactive `ponder` commands for guided knowledge capture

### Workflow Guides

- 4 workflow types: feature, bugfix, refactor, familiarization
- Complexity gate system (LOW / MEDIUM / HIGH)
- TDD enforcement with 11-entry rationalization table
- Two-stage review model (spec compliance + code quality)

---

## Architecture & Structure

```
bin/specdev.js          → CLI entry point, command router (74 lines)
src/commands/           → 6 command modules
src/utils/
  ├── copy.js           → File copying with fs-extra
  ├── scan.js           → Assignment scanning & parsing (221 lines)
  ├── prompt.js         → Interactive CLI prompts via readline (158 lines)
  └── update.js         → Selective system update logic (109 lines)
templates/.specdev/     → Complete template directory shipped to user projects
tests/
  ├── test-scan.js      → Unit tests for scan utility (29 assertions)
  └── verify-output.js  → Output verification tests
```

**Total source**: ~1,300 lines across `bin/` + `src/` (excluding templates).

**Tech stack**: Node.js ≥18, ES modules, single runtime dep (`fs-extra`), Prettier for formatting.

**Update semantics** (`src/utils/update.js`):
- **System paths** (always overwrite): `_main.md`, `_router.md`, `_guides/`, `_templates/`, `project_scaffolding/_README.md`
- **Ensure paths** (create if missing, never overwrite): skills, knowledge branches, READMEs
- **Preserved** (never touched): `project_notes/`, `assignments/`, customized skills

---

## System Documentation

*(Updated by familiarization assignments)*
