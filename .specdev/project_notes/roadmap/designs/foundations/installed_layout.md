# Installed SpecDev Layout

Parent design: `./specdev_state_model.md`

An installed `.specdev/` directory is a portable project layer with explicit
ownership boundaries. Physical proximity does not make managed guidance,
project-authored records, engine checkpoints, and caches interchangeable.

Managed roots include `_main.md`, `_index.md`, `workflow.json`, `workflows/`, core
skills, built-in guides, and templates. They are copied from the package and may be
refreshed. Generated platform skills and hooks mirror canonical product guidance.

Project-owned roots include `project_notes/`, `knowledge/`, custom guides and tools,
`assignments/`, `missions/`, `discussions/`, `test-audits/`, and durable receipts.
Some are created only when first used. Their absence does not change ownership, and
update does not overwrite their authored content.

RippleGraph call state and identity counters are durable engine records, changed by
semantic commands rather than hand editing. Ignored `cache/` and `worktrees/` hold
operational indexes, journals, provider output, leases, and Mission worktrees.

Configuration separates portable defaults from machine-local overrides. Tracked
agent profiles express project policy; ignored local profile overlays express
machine capability without becoming shared authority.

Initialization creates a valid installation, managed Git-ignore boundaries, platform
adapters, and the minimal project scaffold. Update refreshes managed roots, removes
known deprecated managed assets, preserves custom content, backfills missing
standard Roadmap files, and reconciles platform adapters. Semantic layout changes
use the guided migration workflow; legacy assignment-root movement remains an
explicit compatibility command.

Adding a file inside an existing ownership class is ordinary evolution. Reclassifying
a root, allowing update to overwrite project records, placing sole authority in
ignored state, or treating direct checkpoint editing as a supported transition is a
material architecture change.

## Source Targets

- `src/commands/init.js` — maximum 850 lines — installation creation and canonical generated guidance.
- `src/utils/update.js` — maximum 500 lines — managed/preserved path synchronization.
- `src/utils/command-context.js` — maximum 40 lines — target repository and installation boundary.
