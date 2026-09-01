# Repository State and Installation

Status: implemented

## Decision

SpecDev's durable project record is local-first and repository-portable: it can
be inspected, copied, reviewed, and delivered as human-readable, diffable
repository files without a required hosted control plane. Markdown, JSON, and
YAML carry durable intent, authority, evidence, and outcomes; Git carries
revision and delivery history. Derived and operational data may support
execution or recovery, but may not replace those durable records.

SpecDev product behavior is authored in product source, including `src/` and
`templates/.specdev/`. An installed `.specdev/` combines managed runtime,
project-owned durable state, engine-owned workflow state, and ignored
operational state. Managed runtime is shipped from `templates/.specdev/` and is
subject to refresh by `specdev update`; project-owned durable state is created
or adopted through project work and is not refreshable template content.
Engine-owned workflow state changes only through supported SpecDev or
RippleGraph operations, never through direct editing; ignored operational state
is local and replaceable.

Update may replace locally edited managed runtime; such an edit is a local
override, not an authored product change. Update does not refresh project-owned
durable state from template content, reconciles the engine-owned registry with
installed graph packages, and gives ignored operational state no preservation
guarantee. A migration may change project-owned durable state only when the
update discloses the migration and the user explicitly authorizes the update;
conflicts preserve existing destination content unless the user separately
approves destructive handling. Before mutating any update target, update blocks
while a durable Attempt record—a project-owned workflow artifact under
`processes/`—remains running. Tracking `.specdev/` in this dogfooding repository
does not change these ownership boundaries.

Ordinary initialization refuses an existing `.specdev/`. `specdev init --force`
is the explicit destructive-reset exception. When selected for an existing
installation, it removes the entire installed `.specdev/` tree across all four
ownership classes, then creates a fresh
installation from the shipped template. It is not an update or migration path.
It requires explicit user instruction at the point of action; an agent must not
infer it from an ordinary init request or automatically retry with it after init
refuses an existing installation. With no existing installation, the flag adds
no destructive effect. Git can recover committed tracked state, but SpecDev
cannot recover uncommitted or ignored state removed by the reset.

Moving durable project authority out of reviewable repository files into a
required hosted or opaque store, making an installed `.specdev/` a
product-authoring location, letting ordinary init or update overwrite
project-owned durable state outside governed migration, weakening the migration
or quiescence safeguards, making destructive reset implicit, widening its scope,
or adding another destructive installation path is an architecture-change
proposal. It must be disclosed to the user and receive explicit user approval
before implementation.

## Verification

Aligned at Git revision `976ba9582adfa23e47896e5f3bb3f59d3557d5e8` against
`src/commands/init.js`, `src/commands/update.js`, `src/utils/update.js`,
`src/utils/update-quiescence.js`, `src/utils/process-record.js`,
`src/utils/engine.js`, and `templates/.specdev/`.
