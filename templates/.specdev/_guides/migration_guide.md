# SpecDev layout migration guide

Migration is an explicit, user-approved filesystem operation. Inspect first;
never infer permission to move or delete project records.

## Current anchors

```text
.specdev/
  assignments/<id>_<slug>/
    brainstorm/contract.md
    design/plan.md
    implementation/progress.json
    review/
    outcome.md
    status.json
  missions/M<id>_<slug>/
  discussions/D<id>_<slug>/
  project_notes/
  knowledge/
  guides/project/
  processes/
```

Managed runtime files (`_main.md`, `_index.md`, `_guides/`, `_templates/`,
`skills/core/`, `guides/library/`, `workflows/`, and `workflow.json`) should
normally be refreshed by `specdev update`, not moved manually.

## Procedure

1. Inventory the existing tree without modifying it.
2. Search source, tests, templates, and graph packages for every proposed path.
   Referenced paths are load-bearing and stay in place until product code is
   changed.
3. Write `.specdev/migration/layout-plan.md` listing proposed moves, paths to
   leave untouched, conflicts, and open questions.
4. Ask the user to approve the exact plan.
5. Apply only approved non-overwriting moves and keep recoverable backups when a
   collision exists.
6. Run `specdev status --json` and report the resulting tree.

Historical completed layouts are readable documents and do not need conversion.
For the old deterministic root-file move only, discuss `specdev migrate
legacy-assignments --dry-run` first.
