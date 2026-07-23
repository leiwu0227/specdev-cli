# SpecDev Update Guide

`specdev update` replaces managed workflow files and installs versioned graph
packages while preserving project-owned notes, work items, profiles, knowledge,
project guides, custom tool skills, and existing platform adapters.

Legacy files under `knowledge/_workflow_feedback/` move to
`knowledge/workflow_feedback/`. The update stops rather than overwriting a
different destination file with the same name. Custom files in the retired
`project_scaffolding/` directory remain in place, although new workflows do not
consume them.

Completed historical Assignments remain documents and do not need rewriting.
For unfinished legacy work, run `specdev migrate` and inspect the generated
inventory before approving any layout change.

## CLAUDE.md

Ensure your project's `CLAUDE.md` contains the following line near the top (before the `Read .specdev/_main.md` line):

```
`specdev` is a Node.js CLI — run it directly as `specdev <command>`. It is NOT a Python package. Never use pip, python, or pipx to install or run it.
```

If this line is missing, add it.
