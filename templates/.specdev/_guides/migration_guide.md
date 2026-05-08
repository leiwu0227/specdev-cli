# SpecDev Migration Guide

Use this guide when a project has an older or ad hoc `.specdev/` layout and you
need to move artifacts into the current structure. Migration is a semantic task:
inspect first, write a plan, ask the user, then apply only approved moves.

## Target Structure

Current SpecDev projects use this shape:

```text
.specdev/
├── .current
├── _main.md
├── _index.md
├── _guides/
├── _templates/
├── assignments/<id>/
│   ├── brainstorm/
│   ├── breakdown/
│   ├── implementation/
│   ├── review/
│   ├── capture/
│   └── context/
├── discussions/
├── knowledge/
│   ├── architecture/
│   ├── codestyle/
│   ├── domain/
│   └── workflow/
├── project_notes/
├── project_scaffolding/
└── skills/
```

## Agent Workflow

1. Read `.specdev/_main.md` and this guide.
2. Inventory `.specdev/` without moving files.
3. Classify each non-conforming artifact.
4. Write `.specdev/migration/layout-plan.md`.
5. Ask the user to approve the plan and answer open questions.
6. Apply only approved changes.
7. Verify with `specdev status --json` and summarize the final structure.

Useful inventory commands:

```bash
find .specdev -maxdepth 2 -type d | sort
find .specdev -maxdepth 2 -type f | sort
specdev status --json
specdev skills --json
```

## Classification Rules

| Artifact | Likely destination | Notes |
| --- | --- | --- |
| Assignment phase files | `assignments/<id>/<phase>/` | Use the phase folder names from the current workflow. |
| Assignment research or logs | `assignments/<id>/context/` | Keep supporting material near the assignment. |
| Current project facts | `project_notes/` | Use for living notes that agents should read often. |
| Durable cross-assignment learning | `knowledge/<branch>/` | Use `architecture`, `codestyle`, `domain`, or `workflow`. |
| Source maps or generated structure notes | `project_scaffolding/` | Use for scaffolding and project inventory material. |
| Ad hoc docs, wiki, images, editor metadata | Needs user decision | Ask whether to keep inside SpecDev, move outside it, or delete. |

When uncertain, leave the file in place and list it under "Needs User Decision".

## Layout Plan Template

Create `.specdev/migration/layout-plan.md`:

```markdown
# SpecDev Layout Migration Plan

## Inventory Summary

- Current shape:
- Non-conforming top-level paths:
- Assignment folders checked:

## Proposed Moves

| From | To | Reason |
| --- | --- | --- |

## Leave In Place

| Path | Reason |
| --- | --- |

## Needs User Decision

| Path | Question |
| --- | --- |

## Risks

- Existing destination conflicts:
- Ambiguous ownership:
- Files that may belong outside `.specdev/`:

## Verification

- Commands to run after migration:
- Expected final checks:
```

## Safety Rules

- Do not overwrite existing files.
- Do not delete artifacts unless the user explicitly approves deletion.
- Preserve file content and history where practical.
- Prefer `git mv` for tracked files.
- Keep project-specific content out of managed system folders unless it belongs there.
- Do not edit `_main.md`, `_index.md`, `_guides/`, `_templates/`, or `skills/` for project notes.
- Ensure `.specdev/.gitignore` includes `cache/` so generated files (e.g. `knowledge.sqlite`) are not committed.

## Legacy Assignment-File Migration

For the old deterministic V3-to-V4 assignment migration, use the explicit
subcommand:

```bash
specdev migrate legacy-assignments --dry-run
specdev migrate legacy-assignments
specdev migrate legacy-assignments --assignment=<assignment-id>
```

This subcommand only handles root-level assignment files:

- `proposal.md` -> `brainstorm/proposal.md`
- `design.md` -> `brainstorm/design.md`
- `plan.md` -> `breakdown/plan.md`
- `implementation.md` -> `implementation/implementation.md`
- `validation_checklist.md` -> `review/validation_checklist.md`

It also ensures `context/` exists and creates `implementation/progress.json`
when `implementation/` exists. Existing destination files are skipped.
