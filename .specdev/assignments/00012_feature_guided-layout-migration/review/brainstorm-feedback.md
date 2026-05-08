# Brainstorm Review: 00012_feature_guided-layout-migration

## Round 1

**Verdict:** approved

### Findings

1. [F1.1] **Guide file naming overlap.** The design proposes adding `_guides/layout_migration_guide.md`, but `_guides/migration_guide.md` already exists and documents the V3-to-V4 automatic migration. Having two migration guides in the same directory risks confusing agents about which to consult. Recommendation: either replace the existing `migration_guide.md` with a combined guide (covering both the guided workflow and the legacy subcommand), or explicitly state in the design that the old guide is renamed or scoped (e.g., `legacy_migration_guide.md`). Low severity — the implementation can resolve this, but the design should acknowledge the overlap.

2. [F1.2] **Dispatch pattern left unspecified.** The design correctly notes that dispatch may need updating to pass positional args to `migrateCommand`, but doesn't prescribe a pattern. The codebase has two patterns: (a) inline subcommand routing in `dispatchCommand` (used by `distill`/`distill done` at dispatch.js:45-54), and (b) separate entries in `commandHandlers`. Either works, but the `distill` inline pattern is the established precedent for subcommands of a single parent command and is the natural fit. Not blocking — this is an implementation detail, but noting it for the implementer.

3. [F1.3] **Module split structure.** The current `migrate.js` exports a single `migrateCommand`. After this change it would need to serve two code paths: the guided entrypoint and the legacy assignment migrator. The codebase convention is one file per command (e.g., `distill.js` and `distill-done.js` are separate files). The design should clarify whether the legacy path stays in `migrate.js` (renamed export) or moves to a new file like `migrate-legacy.js`. Minor — either approach is clean, but an explicit decision prevents implementation churn.

4. [F1.4] **Feasibility confirmed.** All referenced paths, patterns, and extension points exist in the codebase. The `SKILL_FILES` object in `init.js` supports adding the new skill. The `updateCommand` already refreshes command skills. The template `_guides/` directory exists. The test infrastructure in `test-workflow.js` has migration test patterns to extend. No technical blockers.

### Addressed from changelog

- (none -- first round)
