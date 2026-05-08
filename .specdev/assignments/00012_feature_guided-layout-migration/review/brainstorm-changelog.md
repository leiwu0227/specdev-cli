# Brainstorm Changelog

## Round 1

- Addressed guide naming overlap by deciding to replace the existing `_guides/migration_guide.md` with a combined guide instead of adding a separate `layout_migration_guide.md`.
- Specified the dispatch approach: follow the `distill`/`distill done` subcommand precedent for `migrate legacy-assignments`.
- Specified the module split: keep the guided entrypoint in `migrate.js` and move the old deterministic migrator into a focused legacy module.
