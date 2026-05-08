# SpecDev Layout Migration Plan

## Inventory Summary

- Current shape: Very close to modern target structure
- Non-conforming top-level paths: `cache/` (gitignored runtime data)
- Assignment folders checked: 13 assignments (00001–00013), all using modern phase folders (brainstorm/, breakdown/, capture/, implementation/, review/, context/)
- All standard top-level directories present: `_guides/`, `_templates/`, `assignments/`, `discussions/`, `knowledge/`, `project_notes/`, `project_scaffolding/`, `skills/`

## Proposed Moves

| From | To | Reason |
| --- | --- | --- |
| (none) | — | No moves required — assignment and top-level structure already conforms |

## Leave In Place

| Path | Reason |
| --- | --- |
| `.current` | Standard current-assignment pointer |
| `.gitignore` | Standard; already excludes `cache/` |
| `_main.md`, `_index.md` | Core system files |
| `_guides/*` | System-managed guides |
| `_templates/*` | System-managed templates |
| `assignments/00001–00013/*` | All 13 assignments already use modern phase folders |
| `discussions/D00001_*` | Correct structure |
| `knowledge/_index.md` | Standard index |
| `knowledge/.processed_captures.json` | Internal state tracking |
| `knowledge/architecture/*`, `codestyle/*`, `domain/*`, `workflow/*` | Standard knowledge branches |
| `project_notes/big_picture.md`, `working_memory.md`, etc. | Standard project notes |
| `project_scaffolding/_README.md` | Standard scaffolding |
| `skills/core/*`, `skills/tools/*` | Standard skill directories |
| `cache/knowledge.sqlite` | Runtime cache, already gitignored — not version-controlled |

## Needs User Decision

| Path | Question |
| --- | --- |
| `knowledge/_workflow_feedback/` (7 files) | This is an extra knowledge branch not in the standard set (architecture, codestyle, domain, workflow). Should it be: (a) kept as-is (it's a valid custom branch), (b) merged into `knowledge/workflow/`, or (c) renamed to drop the underscore prefix → `knowledge/workflow_feedback/`? |
| `project_notes/thoughts/2026-03-04 distillation.txt` | Informal note in a `thoughts/` subdirectory under project_notes. Should it be: (a) kept as-is, (b) moved to `project_notes/` root, or (c) deleted if no longer needed? |

## Risks

- Existing destination conflicts: None — no proposed moves
- Ambiguous ownership: `knowledge/_workflow_feedback/` could belong under `workflow/` but may be intentionally separate
- Files that may belong outside `.specdev/`: None identified

## Verification

- Commands to run after migration:
  - `specdev status --json`
  - `find .specdev -maxdepth 2 -type d | sort`
- Expected final checks:
  - All assignment phase folders intact
  - Knowledge branches consistent
  - No orphaned files at `.specdev/` root
