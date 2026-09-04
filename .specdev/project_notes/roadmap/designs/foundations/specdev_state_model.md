# SpecDev State Model

Parent design: `../core_concepts.md`

SpecDev keeps durable project meaning separate from managed software, workflow
position, and replaceable execution state. This lets a repository recover without a
hosted control plane or a surviving provider conversation.

Managed runtime is shipped by SpecDev: entry guidance, built-in skills, workflow
packages, templates, and managed guides. Initialization installs it and update may
refresh it. Local modifications are runtime drift, not product-source authority.

Project-owned durable state records the consuming project's context, designs,
knowledge, configuration, contracts, evidence, findings, outcomes, receipts, and
completed callable artifacts. Maintenance preserves these records unless an exact
migration or user decision authorizes a semantic change.

Engine-owned state records identities, checkpoints, transitions, and active
orchestration. RippleGraph bytes are changed only through semantic CLI operations.
Human-readable contracts and outcomes explain meaning; engine state explains
position. Neither substitutes for the other.

Operational state includes indexes, provider output, PID markers, temporary
worktrees, review continuation leases, journals, and caches. It may improve recovery
or performance, but it is normally ignored and must be reconstructible from durable
sources or safely abandoned.

Git is orthogonal to these classes. It owns revisions and delivery history, while
the path classifier records which lane owns current dirt. Transactions bind current
state to Git identities and fail closed on mismatched revisions, ambiguous ownership,
changed artifacts, or live execution.

IDs are allocated atomically per entity family. A workflow identity is not an agent
Attempt, process, branch, worktree, or review round. Terminal compaction preserves a
bounded human summary before removing replaceable run and Attempt state.

Initialization, update, migration, delivery, and recovery preserve authority before
retiring operational data. Repeated recovery operations converge safely rather than
creating duplicate identities or outcomes.

## Source Targets

- `src/utils/current.js` — maximum 150 lines — focused identity pointer and validation.
- `src/utils/id-reservation.js` — maximum 180 lines — atomic entity ID allocation.
- `src/utils/workspace-changes.js` — maximum 110 lines — dirty-path ownership classification.
- `src/utils/maintenance-quiescence.js` — maximum 260 lines — safe maintenance boundaries.
