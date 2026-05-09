# CLAUDE.md

`specdev` is a Node.js CLI — run it directly as `specdev <command>`. It is NOT a Python package. Never use pip, python, or pipx to install or run it.

Read `.specdev/_main.md` for the full SpecDev workflow and rules.

This repository develops SpecDev itself. Treat `.specdev/` as the installed workflow/runtime state, not as product source. When changing SpecDev behavior, edit source files such as `src/`, `templates/.specdev/`, tests, and docs. Do not edit or commit `.specdev` workflow files unless the user explicitly runs or asks for `specdev update`.

IMPORTANT: Before starting any subtask, announce "Specdev: <what you're doing>".
If you stop announcing subtasks, the user will assume you've stopped following the workflow.

IMPORTANT: Always confirm with the user before running tests. Do not run `npm test` or any test command without explicit user approval.
