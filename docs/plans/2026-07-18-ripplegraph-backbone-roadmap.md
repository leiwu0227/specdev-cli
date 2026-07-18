# RippleGraph Backbone Migration Roadmap

**Date:** 2026-07-18
**Status:** Implemented with active-assignment compatibility
**Branch:** `feature/ripplegraph-backbone`

## Purpose

Migrate SpecDev's workflow backbone to RippleGraph using the established
OceanLive and OceanShed integration pattern. RippleGraph will own durable
workflow sequencing, decisions, resumability, and run history. Existing
SpecDev commands, skills, agents, and scripts will remain authoritative for
filesystem changes, artifact validation, review execution, and other product
behavior.

The migration will use an infra-first strangler approach. Existing projects and
active assignments must continue to work while graph coverage is added one
workflow at a time.

## Agreed Decisions

- Graph packages become the final sequencing authority.
- `.specdev/workflow.yaml` is retired after the compatibility period; there is
  no permanent YAML-to-graph compiler.
- Assignments already active when a project upgrades finish on the legacy
  runtime. New assignments use RippleGraph after the assignment graph ships.
- The public adapter follows the other RippleGraph-backed CLIs:
  `do`, `next`, `status`, `decide`, `step`, and `action`.
- Existing semantic commands remain public and authoritative for their product
  operations.
- The backbone migration includes all top-level guided workflows, not only the
  assignment lifecycle.
- Custom `workflow.yaml` migration is out of scope unless real customized
  manifests are discovered.

## Target Architecture

```text
User or host agent
        |
        v
SpecDev product commands and adapter
        |
        +---- existing commands, skills, agents, scripts
        |     own execution, validation, and filesystem effects
        |
        v
RippleGraph
        |
        +---- dispatcher and registered graph packages
        +---- focused run, gates, transitions, history
        +---- state under .specdev/.ripplegraph/
```

Installed graph packages live under `.specdev/workflows/`. Source graph
packages live under `templates/.specdev/workflows/`. A product-owned
`.specdev/workflow.json` selects the metadata-only workspace dispatcher.
`init` and `update` register the installed packages idempotently and remove
stale registrations.

Raw graph IDs, node IDs, run IDs, and engine recovery vocabulary must not leak
through ordinary SpecDev output. The adapter translates RippleGraph state into
SpecDev phases, instructions, choices, commands, and recovery messages.

## Graph Inventory

### `workspace-dispatcher`

Metadata-only front door that routes user intent to a new workflow, resumes a
matching run, reports status, or asks for a narrower request.

### `project-orientation`

Guides project context setup: inspect `big_picture.md`, collect missing project
information, write the durable context, and verify readiness. Existing project
context utilities remain authoritative.

### `assignment-lifecycle`

Owns the complete assignment journey: create or focus an assignment,
brainstorm, checkpoint and review choice, approval, breakdown, implementation,
final checkpoint and review choice, approval, completion, and phase-end hooks.
Assignment types use one graph with product metadata rather than separate graph
packages.

### `discussion-lifecycle`

Owns parallel brainstorming discussions, including artifact creation and
optional review. It intentionally has no assignment approval gates and no
assignment autocontinue behavior.

### `layout-migration`

Owns the guided migration journey: inventory, proposed layout plan, explicit
user confirmation, approved filesystem changes, and verification. The existing
mechanical legacy-assignment mover remains a separate command.

### `knowledge-distillation`

Owns project and workflow distillation: scan captures, select or refine
suggestions, update durable knowledge, and mark selected assignments processed.
The current scan and mark commands remain the execution boundary.

## Roadmap

### A0 - Foundation and Adapter Skeleton

Raise the supported Node.js version to 20, vendor RippleGraph from
`/Users/leiwu/code/ripplepulse/lib/ripplegraph`, include the vendor artifact in
the npm package, and add the engine bootstrap and product-state adapter.

Establish the complete public command surface:

- `specdev do "<intent>"`
- `specdev next`
- `specdev status`
- `specdev decide <value>`
- `specdev step [--json <output>]`
- `specdev action <id> [--json <output>]`

Register a temporary fixture graph that proves dispatch, gate decisions,
non-gated steps, side-channel actions, status, resume, cancellation, and product
output translation. Wire registration into both `init` and `update`.

**Exit:** The adapter drives the fixture end to end, packed installations can
load RippleGraph, registration is idempotent, and no raw engine vocabulary is
exposed to normal users.

### A1 - Project Orientation Graph

Replace the temporary fixture with the safest real workflow. The graph guides
the existing `specdev start` behavior and project-context skill without moving
file parsing or writing into the graph adapter.

**Exit:** A new or incomplete project can enter through `specdev do`, complete
its context, resume after interruption, and reach a verified terminal state.

### A2 - Assignment Lifecycle Graph

Model the current brainstorm, breakdown, and implementation lifecycle in one
cohesive graph. Gates represent exact user choices. Nodes invoke or request
existing semantic commands and accept compact evidence rather than duplicating
their implementation.

Integrate `assignment`, `checkpoint`, `approve`, `implement`, `review`,
`reviewloop`, `revise`, and progress tracking with the focused run. New
assignments start graph runs. Assignments already active at upgrade remain on
the legacy runtime until completion.

**Exit:** A new assignment runs end to end through RippleGraph with artifact,
approval, review, interruption, resume, and failure-recovery parity.

### A3 - Discussion Lifecycle Graph

Add the discussion-specific brainstorm and review flow. Share command behavior
with assignments, but keep graph semantics explicit where discussion behavior
differs.

**Exit:** Discussions are independently dispatchable and resumable, optional
review works, and no assignment-only approval or continuation is emitted.

### A4 - Layout Migration Graph

Convert the existing agent-guided layout migration into a durable graph. Put
external decision gates before every ambiguous or destructive filesystem
change. Keep `migrate legacy-assignments` as the narrow mechanical utility.

**Exit:** Migration can be paused after inventory or planning, resumed safely,
and cannot apply unapproved moves, renames, or deletions.

### A5 - Knowledge Distillation Graph

Add one graph with an early choice between project and workflow distillation.
Orchestrate the existing scanner, knowledge files, suggestion review, and
processed-capture ledger.

**Exit:** Both distillation modes are dispatchable and resumable, and captures
are marked processed only after durable knowledge updates succeed.

### A6 - Product Cutover

Route `next`, `status`, `continue`, installed agent guidance, and session-start
orientation through the RippleGraph adapter. Make graph packages authoritative
for every new guided workflow. Thin skills and guides so they provide node-level
execution guidance rather than a second sequencing system.

Replace prose-shape and manifest-runtime tests with the three-layer contract
used by the reference migrations:

1. Graph-package loading and structural validation.
2. Product adapter and command behavior.
3. Integration coverage at existing command and filesystem boundaries.

**Exit:** Every top-level guided workflow enters through or synchronizes with
RippleGraph, while direct semantic commands remain usable and safe.

### A7 - Legacy Runtime Retirement

After the compatibility window, remove `workflow.yaml` as an installed runtime
contract and delete obsolete sequencing logic from `workflow-runtime.js` and
related adapters. Preserve only the minimal detection needed to explain how an
unfinished legacy assignment should be completed or recovered.

Update documentation, templates, package contents, and drift checks to enforce
graph packages as the single sequencing authority.

**Exit:** There is no duplicate workflow authority, no generated compatibility
graph, and no normal execution path through the legacy manifest runtime.

## Ownership Boundaries

RippleGraph owns:

- workflow selection and focused runs;
- node position and legal transitions;
- external decision gates;
- run suspension, resume, abandonment, and history;
- side-channel action history and external-state reconciliation.

SpecDev owns:

- assignment and discussion directory layouts;
- artifact schemas and validation;
- approval fields and compatibility state;
- reviewer process execution and review policy;
- skills, agents, and host-specific instructions;
- migration filesystem safety;
- knowledge indexing, writing, and processed-capture ledgers;
- all user-facing terminology and rendering.

## Compatibility and Failure Policy

- Engine bootstrap runs lazily before adapter operations and eagerly during
  `init` and `update`.
- Missing or damaged engine state produces product-shaped recovery guidance;
  callers never edit `.specdev/.ripplegraph/` manually.
- Graph state does not prove a filesystem effect succeeded. Nodes advance only
  after existing commands return valid evidence.
- External artifact drift is reconciled explicitly. It is never silently
  treated as a successful graph transition.
- Legacy active assignments are detected and routed to the old runtime. New
  assignments never start on the old runtime after A2.
- Graph package upgrades preserve resumable runs when compatible. Breaking
  graph changes require a versioned compatibility policy before release.

## Verification Strategy

Each roadmap stage adds proportionate coverage:

- load every shipped graph through RippleGraph's package loader;
- assert one metadata-only dispatcher and valid workflow references;
- exercise adapter state translation without exposing engine identifiers;
- drive gates, steps, actions, resume, abandon, and invalid evidence paths;
- verify `init`, `update`, and packed installation registration;
- retain focused tests around authoritative semantic commands;
- add end-to-end fixtures for each completed workflow graph;
- verify legacy and graph-managed assignments can coexist during migration.

The final suite should test contracts and user-visible failures rather than
pinning incidental graph node wording.

## Completion Criteria

The migration is complete when:

- all six graph packages are installed, registered, and dispatchable;
- all top-level guided workflows are resumable through the public adapter;
- existing semantic commands remain authoritative and behavior-compatible;
- active legacy assignments can finish without conversion;
- new assignments and discussions use RippleGraph exclusively;
- migration and distillation require durable evidence before advancing;
- installed guidance treats graph state as the sequencing authority;
- `workflow.yaml` and obsolete runtime sequencing are removed;
- npm packaging contains the vendored RippleGraph dependency; and
- graph-package, adapter, integration, and compatibility verification pass.

## Implementation Result

Stages A0-A6 are implemented. New installations contain no `workflow.yaml`,
and all new guided work uses the six registered graph packages. The old
workflow runtime remains reachable only when an unfinished assignment from a
pre-RippleGraph installation is detected. Its final deletion is intentionally
deferred until that agreed compatibility window closes.
