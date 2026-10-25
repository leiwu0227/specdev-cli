# SpecDev Update Guide

`specdev update` replaces managed workflow files and installs versioned graph
packages. It preserves project-owned notes, work items, profiles, knowledge,
project guides, custom tool skills, and existing platform adapters.
Before changing managed state, update checks every running Attempt.
Live execution or uncertain ownership blocks the update and shows a recovery action.
Update records a local Attempt as interrupted only when it is proven stale.
Do not exclude the current agent or force a bypass when it runs under an Attempt.

When an existing adapter contains stale SpecDev guidance, update returns a
provider-neutral operation such as `UPD00001`. Reconcile only the reported
SpecDev section, then run the exact emitted command, for example
`specdev update --operation=UPD00001`. That command again checks for running Attempts.
It checks that orientation is current and obsolete references are removed.
It also checks that project-owned sections are unchanged, byte for byte.
Only then does it write a terminal receipt.

Use `specdev update --status` to discover interrupted update operations. If the
reported boundary is ambiguous, do not rewrite it without user direction.
`specdev update --dry-run` reports adapter and quiescence status but creates no
operation or Attempt reconciliation. Status inspection is also read-only and
remains available while maintenance is blocked.

Legacy files under `knowledge/_workflow_feedback/` move to
`knowledge/workflow_feedback/`. The update stops rather than overwriting a
different destination file with the same name. Custom files in the retired
`project_scaffolding/` directory remain in place, although new workflows do not
consume them.

Completed historical Assignments remain documents and do not need rewriting.
For unfinished legacy work, run `specdev migrate` and inspect the generated
inventory before approving any layout change.

## Tracked installed updates

A successful update needs no extra cleanup workflow. If it leaves tracked managed
files changed, handle them once at the next authorized Git boundary. Inspect the
diff and keep project-owned edits and unrelated workflow artifacts separate.

If the next lane requires a clean start, checkpoint the inspected managed changes
together before starting that lane. Otherwise include them in the next delivery
only when its scope and ownership rules allow it. Use explicit adoption where
required. Do not change HEAD inside an active Adhoc or another frozen Git boundary.
An update does not grant permission to commit unrelated work or bypass ownership.

After the installed changes are recorded, reuse that decision unless the files
change again. Do not create one checkpoint per file or repeat update commands
merely to obtain a clean status.

## Current orientation

Every supported adapter should direct agents to read `.specdev/_main.md`.
Project-owned instructions outside an identifiable SpecDev section remain unchanged.

For `CLAUDE.md`, also ensure the following line appears near the top (before the
`Read .specdev/_main.md` line):

```
`specdev` is a Node.js CLI — run it directly as `specdev <command>`. It is NOT a Python package. Never use pip, python, or pipx to install or run it.
```

If this line is missing, add it.
