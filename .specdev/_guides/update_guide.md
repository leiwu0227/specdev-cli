# SpecDev Update Guide

`specdev update` replaces managed workflow files and installs versioned graph
packages while preserving project-owned notes, work items, profiles, knowledge,
project guides, custom tool skills, and existing platform adapters. When an
existing adapter contains stale SpecDev guidance, update returns a provider-neutral
operation such as `UPD00001`. Reconcile only the reported SpecDev section, then
run the exact emitted command, for example `specdev update --operation=UPD00001`.
That command validates current orientation, removed obsolete references, and
byte-preservation of project-owned sections before writing a terminal receipt.

Use `specdev update --status` to discover interrupted update operations. If the
reported boundary is ambiguous, do not rewrite it without user direction.
`specdev update --dry-run` reports adapter status but creates no operation.

Legacy files under `knowledge/_workflow_feedback/` move to
`knowledge/workflow_feedback/`. The update stops rather than overwriting a
different destination file with the same name. Custom files in the retired
`project_scaffolding/` directory remain in place, although new workflows do not
consume them.

Completed historical Assignments remain documents and do not need rewriting.
For unfinished legacy work, run `specdev migrate` and inspect the generated
inventory before approving any layout change.

## Current orientation

Every supported adapter should direct agents to read `.specdev/_main.md`.
Project-owned instructions outside an identifiable SpecDev section remain unchanged.

For `CLAUDE.md`, also ensure the following line appears near the top (before the
`Read .specdev/_main.md` line):

```
`specdev` is a Node.js CLI — run it directly as `specdev <command>`. It is NOT a Python package. Never use pip, python, or pipx to install or run it.
```

If this line is missing, add it.
