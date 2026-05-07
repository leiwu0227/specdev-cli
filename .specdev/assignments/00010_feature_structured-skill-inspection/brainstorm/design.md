# Structured Skill Inspection

## Overview

SpecDev already installs core and tool skills under `.specdev/skills/`, and `specdev skills` lists them for humans. Agents, however, still need to infer file paths and read full `SKILL.md` files manually. Hermes' progressive disclosure pattern suggests a better shape: expose a small structured index first, then let the agent request a single skill or a specific relative support file.

This assignment adds read-only inspection to the existing skills command family. The first version should provide `specdev skills --json` for structured listing and `specdev skills view <name> [relative-path]` for loading a skill's `SKILL.md` or a file beneath that skill directory.

## Goals

- Add `specdev skills --json` that emits a stable JSON list of core and tool skills.
- Include enough metadata for agents to choose what to load: name, category, description, path, `skill_md_path`, `has_scripts`, and tool activation status where applicable.
- Add `specdev skills view <name> [relative-path]` to print `SKILL.md` by default or a specific file inside the skill directory.
- Support both core and tool skills with the same lookup behavior.
- Preserve existing text output for `specdev skills`.

## Non-Goals

- Do not add remote skill registries, package installation, or third-party marketplace behavior.
- Do not modify skill contents or activation state.
- Do not load arbitrary files outside a matched skill directory.
- Do not introduce a separate top-level `specdev skill` command unless the existing dispatch shape makes it clearly cheaper than extending `specdev skills`.
- Do not implement long-term memory or SQLite-backed skill provenance in this assignment.

## Design

Extend `src/utils/skills.js` so skill scanning returns richer records instead of only display metadata. Folder skills should include the directory path and `SKILL.md` path. Flat markdown skills should still appear in listings, but `skills view` can treat their markdown file as both the skill path and default view target. The JSON shape should be versioned:

```json
{
  "command": "skills",
  "version": 1,
  "status": "ok",
  "skills": []
}
```

`src/commands/skills.js` should route `skills view` before install/remove/sync. The view command resolves the target project via `--target`, scans core and tool skills, finds the named skill, and prints file content. If a relative path is supplied, it must normalize and verify the resolved path stays inside the skill directory before reading. Missing skills, missing files, and blocked traversal should exit with code 1 and clear stderr.

`skills --json` should share the same scanner used by text output, avoiding two inventories. Tool activation can continue to come from `active-tools.json`; core skills should not get active/available status.

## Success Criteria

- `specdev skills --json` emits valid JSON with all installed core and tool skills.
- JSON output includes category, description, paths, scripts flag, and active status for tool skills.
- `specdev skills view brainstorming --target=<dir>` prints the brainstorming `SKILL.md`.
- `specdev skills view <tool> scripts/<file>` can print a file inside a tool skill.
- Traversal attempts such as `../active-tools.json` fail without reading outside the skill directory.
- Existing `specdev skills`, install, remove, and sync behavior remains unchanged.
- Targeted skills tests and the full test suite pass.
