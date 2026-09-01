# Initialized `.specdev` Layout

Status: implemented

## Folder structure

```text
.specdev/
├── _main.md                     managed workflow entry point
├── _index.md                    managed path and command index
├── _guides/                     managed workflow policies
├── _templates/                  managed artifact templates and examples
├── workflow.json                managed workflow manifest
├── workflows/
│   ├── catalog.json             installed graph-package catalog
│   └── <graph-id>@<version>/    immutable RippleGraph packages
├── .ripplegraph/                engine-owned registry and active checkpoints
├── agents.yaml                  project-owned agent preferences
├── executors.yaml               project-owned capability declarations
├── guides/
│   ├── library/                 managed guide library
│   └── project/                 project-owned guides
├── skills/
│   ├── core/                    managed core skills
│   └── tools/                   project and tool extensions
├── project_notes/
│   ├── big_picture.md           user-filled project-context starter
│   ├── feature_descriptions.md  project feature notes
│   └── architecture/            empty protected authority location
│       └── legacy/              empty superseded-history location
├── knowledge/
│   ├── codebase/                revisable implementation facts
│   ├── faq/                     current troubleshooting knowledge
│   ├── codestyle/               project coding conventions
│   ├── domain/                  domain knowledge
│   ├── workflow/                project workflow knowledge
│   └── workflow_feedback/       reusable SpecDev process observations
├── adhoc/                       bounded-change receipts
├── assignments/                 Assignment delivery records
├── knowledge-curations/         knowledge publication receipts
├── publications/                shared-note publication receipts
├── missions/                    created when first needed
├── discussions/                 created when first needed
├── test-audits/                 created when first needed
├── processes/                   active Attempt records; created on demand
├── cache/                       ignored machine-local operational state
└── worktrees/                   ignored bounded Mission worktrees
```

## Decision

An initialized `.specdev/` combines four ownership classes:

- **Managed runtime** is installed from `templates/.specdev/` and may be
  refreshed by `specdev update`. It includes workflow instructions, guides,
  templates, core skills, and versioned graph packages.
- **Project-owned durable state** includes project notes, living knowledge,
  configuration, custom guides and skills, workflow artifacts, and receipts.
  Init may create empty roots or starter files, but update preserves their
  project-owned content.
- **Engine-owned workflow state** under `.ripplegraph/` records the registry and
  recoverable active runs or calls. It is changed only through supported
  SpecDev and RippleGraph operations.
- **Ignored operational state** under `cache/` and `worktrees/` is local and
  replaceable. It must never be the sole durable record of user authority,
  accepted evidence, or outcomes.

`specdev init` creates `project_notes/architecture/` and its `legacy/`
subdirectory but does not populate either with architecture notes. Active notes
appear only after exact user approval through protected publication.

The diagram binds the stable roots and their ownership, not every generated
file or on-demand subdirectory. Adding files within the correct root does not
itself change the architecture.

Renaming or removing a stable root, changing a root between managed and
project-owned authority, auto-seeding protected architecture, or moving durable
human records exclusively into ignored or engine-private state requires
explicit user notification and approval as an architecture change.

## Verification

Aligned at Git revision `db8d1a2918726c4a777c7532b1af18d4672a9a1d`
against `src/commands/init.js`, `src/commands/update.js`,
`src/utils/update.js`, `src/utils/protected-architecture.js`,
`src/utils/engine.js`, `templates/.specdev/`,
`templates/.specdev/_index.md`, and `templates/.specdev/.gitignore`.
