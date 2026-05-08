# Guided Layout Migration Design

## Overview

This feature repurposes migration from an automatic file mover into an agent-guided workflow for modernizing legacy `.specdev/` directories. The motivating case is a legacy project where `.specdev/` contains modern assignment folders mixed with extra top-level folders, ad hoc project notes, source mirrors, documentation, and editor metadata. A CLI cannot safely classify those artifacts without project context, so the default experience should teach a coding agent how to inspect and collaborate with the user rather than silently rearranging files.

The existing automatic assignment-root migration remains valuable, but it should no longer be the unqualified `specdev migrate` behavior. The design keeps that mechanic available through an explicit legacy command path, while making the primary migration entrypoint a guide launcher.

## Goals

- Make `specdev migrate` non-destructive by default.
- Provide a clear guide for coding agents to migrate legacy `.specdev/` layouts into the current structure.
- Add an agent command skill, installed by `specdev init` and refreshed by `specdev update`, that invokes the guide directly.
- Preserve the old deterministic assignment file migration under an explicit command path so existing users are not stranded.
- Update docs and tests so command help, README examples, and migration behavior match the new contract.

## Non-Goals

- Do not build a fully automatic whole-directory migrator.
- Do not infer project-specific classification for ambiguous files without user confirmation.
- Do not move or delete legacy artifacts as part of `specdev update`.
- Do not add SQLite or historical session storage in this assignment.
- Do not redesign the core `.specdev/` folder structure; this assignment documents and operationalizes the existing structure.

## Design

`specdev migrate` becomes a guided entrypoint. It validates that `.specdev/` exists, then prints a concise migration workflow: read `.specdev/_guides/layout_migration_guide.md`, inventory the current layout, write a proposed plan under `.specdev/migration/layout-plan.md`, ask the user about ambiguous artifacts, and only then apply approved edits. It should mention the agent skill name so users can invoke the same workflow conversationally.

The existing automatic migrator should move behind an explicit path, likely `specdev migrate legacy-assignments [--dry-run] [--assignment=<id>]`. This path keeps the current deterministic rules: move root-level `proposal.md`, `design.md`, `plan.md`, `implementation.md`, and `validation_checklist.md` into phase folders; ensure `context/`; create `implementation/progress.json` when needed; never overwrite destinations. If the command dispatch cannot currently pass migrate subcommands, update it to pass positional args to `migrateCommand`.

Replace the current narrow `.specdev/_guides/migration_guide.md` with a combined migration guide rather than adding a second similarly named guide. The guide should lead with the guided layout migration workflow, then include a clearly scoped section for the explicit legacy assignment subcommand. This avoids two competing migration guide names in `_guides/`.

The guide should include the modern target structure, inspection commands, a classification table, a plan template, conflict handling, and a hard requirement to ask before moves. It should classify likely destinations as `assignments/<id>/<phase>/`, `project_notes/`, `knowledge/<branch>/`, `project_scaffolding/`, or "needs user decision".

Add `specdev-layout-migration` to command skills in `src/commands/init.js`, causing `specdev init` and `specdev update` to install it into `.claude/skills/` and `.codex/skills/`. The skill should point agents to the guide and require an inspect-plan-confirm-apply sequence.

For command structure, use the established subcommand routing precedent from `distill`/`distill done`: dispatch should route `specdev migrate legacy-assignments` separately from bare `specdev migrate`. Keep the guided entrypoint in `src/commands/migrate.js` and move the old deterministic file mover into a new module such as `src/commands/migrate-legacy-assignments.js` so each file remains focused.

## Success Criteria

- Running `specdev migrate` on a SpecDev project does not move files and prints guided migration instructions.
- Running the explicit legacy assignment migration path preserves the old automatic behavior and test coverage.
- `specdev init` installs the new `specdev-layout-migration` command skill for Claude and Codex.
- `specdev update` refreshes command skills so existing projects receive the new skill when command skill directories exist.
- README/help text no longer describes unqualified `specdev migrate` as automatic.
- The existing `_guides/migration_guide.md` becomes the single migration guide and clearly separates guided layout migration from legacy assignment-file migration.
- Tests cover the new non-destructive default and the explicit legacy subcommand.

## Testing Approach

Use the existing Node test style. Update `tests/test-workflow.js` migration tests so `specdev migrate --target=<dir>` asserts legacy files are untouched and the output points to the guide. Add coverage for `specdev migrate legacy-assignments --dry-run`, `specdev migrate legacy-assignments`, and `--assignment=<id>`. Update init/update tests to assert the new command skill is installed/refreshed. Run the focused tests first, then the full `npm test`.

## Risks

The main compatibility risk is users or automations that run `specdev migrate` expecting it to apply old assignment moves. Keeping the old behavior under an explicit `legacy-assignments` path and documenting the change mitigates this while aligning the default with the safer user preference.

Another risk is guide sprawl. The guide should stay procedural and concrete: inventory, classify, plan, confirm, apply, verify. It should avoid trying to cover every possible legacy artifact with automatic rules.
