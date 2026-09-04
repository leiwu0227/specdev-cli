# Managed Installation and Update

Parent design: `../foundations/installed_layout.md`

SpecDev installs a managed runtime into a repository while preserving project-owned
state. Initialization, update, and migration are different authority boundaries and
must not be interchangeable.

Initialization validates the target, creates the installed layout, copies managed
templates, installs versioned workflow packages, writes generated command skills and
platform adapters, establishes managed ignore rules, and seeds only predetermined
empty project files. Destructive reinitialization is explicit because installed
state may contain durable records that cannot be reconstructed.

Update refreshes managed files from the package, removes only recognized deprecated
managed assets, backfills missing standard scaffold files, and preserves project
notes, knowledge, workflow artifacts, custom tools, profiles, and project guides.
Existing unmanaged platform adapters are not overwritten. Adapter reconciliation is
a provider-neutral callable when deterministic copying cannot safely finish the
semantic update.

Maintenance begins only when active workflow state is quiescent or safely
reconcilable. Interrupted update operations resume by operation identity, validate
their baseline, and converge without duplicating changes. Dry-run reports intended
effects without mutation.

Layout migration is separately guided. It inventories current state, proposes an
exact plan, waits for user approval, applies only that plan, and verifies the result.
The legacy assignment-root mover remains a narrow compatibility command with an
independent dry-run.

The package release date is user-visible build identity even when semver is
unchanged. Generated skills and adapters derive from canonical source; installed
copies are refreshed results, never parallel authoring locations.

## Source Targets

- `src/commands/init.js` — maximum 850 lines — installation creation and generated integration guidance.
- `src/commands/update.js` — maximum 680 lines — update orchestration and completion flow.
- `src/utils/update.js` — maximum 500 lines — managed synchronization and preservation.
- `src/utils/update-completion.js` — maximum 280 lines — semantic adapter reconciliation.
- `src/utils/maintenance-quiescence.js` — maximum 260 lines — safe maintenance admission.
- `src/commands/migrate.js` — maximum 80 lines — guided migration entrypoint.
- `src/commands/migrate-legacy-assignments.js` — maximum 280 lines — legacy root compatibility migration.
