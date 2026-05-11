# SpecDev Layout Migration Plan

## Inventory Summary

- Current shape: Conforms to the modern target layout.
- Top-level dirs present: `_guides/`, `_templates/`, `agents/`, `assignments/`, `discussions/`, `knowledge/`, `project_notes/`, `project_scaffolding/`, `skills/`, plus runtime `cache/` (gitignored) and `migration/` (this folder).
- Assignment folders checked: 19 assignments (00001–00019), all using modern assignment folders. Completed/older assignments use the standard phase folders (`brainstorm/`, `breakdown/`, `capture/`, `context/`, `implementation/`, `review/`) where applicable. The active 00019 assignment is still in brainstorm and therefore currently has only `brainstorm/` and `context/`, which is not non-conforming.
- Discussion folders checked: 3 discussions (D00001–D00003), all using `brainstorm/proposal.md` and `brainstorm/design.md`.
- `cache/` is in `.specdev/.gitignore`.

## Proposed Moves

| From | To | Reason |
| --- | --- | --- |
| (none) | — | Structure already conforms. No moves required. |

## Leave In Place

| Path | Reason |
| --- | --- |
| `.current`, `.gitignore` | Standard runtime/system files |
| `_main.md`, `_index.md` | Core system files |
| `_guides/*`, `_templates/*` | System-managed guides and templates |
| `agents/researcher/*` | Documented in `_index.md`; used by `specdev research` |
| `assignments/00001–00019/*` | Assignments already use modern folders for their current phase/state |
| `discussions/D00001_*`, `D00002_*`, `D00003_*` | Conforming discussion folders |
| `knowledge/_index.md`, `knowledge/.processed_captures.json` | Standard knowledge index and capture state |
| `knowledge/architecture/`, `codestyle/`, `domain/`, `workflow/` | Standard knowledge branches |
| `knowledge/workflow_feedback/` | Documented in `knowledge/_index.md` as an intentional branch for SpecDev-workflow feedback (not project-specific). Treat as part of the project structure. |
| `project_notes/*` | Standard project notes; `thoughts/` is a freeform subdir under `project_notes/` |
| `project_scaffolding/_README.md` | Standard scaffolding |
| `skills/core/*`, `skills/tools/*`, `skills/README.md`, `skills/active-tools.json` | Standard skill directories and metadata |
| `cache/knowledge.sqlite` | Runtime cache, gitignored, not version-controlled |

## Needs User Decision

| Path | Question |
| --- | --- |
| `.specdev/migration/layout-plan.md` | After verification, do you want to delete this scratch file or keep it for the record? |

## Risks

- Existing destination conflicts: None — no moves proposed.
- Ambiguous ownership: None observed.
- Files that may belong outside `.specdev/`: None identified.

## Verification

- Commands to run after migration:
  - `specdev status --json`
  - `find .specdev -maxdepth 2 -type d | sort`
- Expected final checks:
  - All assignment phase folders intact
  - Knowledge branches consistent (including documented `workflow_feedback/`)
  - No orphaned files at `.specdev/` root
