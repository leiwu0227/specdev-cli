# AGENTS.md

Read `.specdev/_main.md` for the full SpecDev workflow and rules.

This repository develops SpecDev itself. Treat `.specdev/` as the installed workflow/runtime state, not as product source. When changing SpecDev behavior, edit source files such as `src/`, `templates/.specdev/`, tests, and docs. Do not edit or commit `.specdev` workflow files unless the user explicitly runs or asks for `specdev update`.

Before committing any repo change, update `package.json` `releaseDate` to the current date. This repo uses `releaseDate` as the user-visible build date even when the npm semver version is unchanged.

IMPORTANT: Before starting any subtask, announce "Specdev: <what you're doing>".
If you stop announcing subtasks, the user will assume you've stopped following the workflow.
