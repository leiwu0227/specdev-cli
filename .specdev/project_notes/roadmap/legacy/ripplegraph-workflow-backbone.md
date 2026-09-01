# RippleGraph Workflow Backbone

Status: implemented

## Decision

[RippleGraph](https://github.com/leiwu0227/ripplegraph) is SpecDev's pinned
workflow dependency and orchestration backbone.
Graph-governed stateful workflows and isolated callables use versioned graph
packages, explicit transitions, distinct run or call identities, and
recoverable checkpoints.

SpecDev CLI commands are the supported interface for advancing graph state;
direct checkpoint edits bypass that interface and are unsupported. Isolated
callables advance only through their lifecycle-specific commands. A focused
workflow with a semantic-command reservation advances only through its reserved
commands. Assignment and Mission currently have that reservation, so the engine
rejects generic `step`, `decide`, and `action` for them. A focused graph without
that reservation may accept those commands only when RippleGraph validates the
operation at the current node.

RippleGraph owns workflow orchestration, not every SpecDev action. Direct work,
Adhoc changes, and the exact-byte `specdev publish` action remain graph-free.
Human-approved SpecDev artifacts are authoritative for intent; durable evidence
artifacts record verification, while Git is authoritative for revision and
delivery history.

Replacing RippleGraph, bypassing its transitions or supported command interface
for graph-governed work, removing or bypassing an established semantic-command
reservation, or making provider-session continuity the only recovery mechanism
instead of repository checkpoints requires explicit user notification and
approval as an architecture change.

## Verification

Aligned at Git revision `9693484d9bd250ed4766e160d84d281a15a16f0a` against
`package.json`, `src/utils/engine.js`, `src/utils/engine-sync.js`,
`src/utils/callable-sync.js`, `src/commands/engine.js`,
`src/commands/assignment.js`, `src/commands/mission.js`,
`src/commands/adhoc.js`, `src/commands/publish.js`,
`src/utils/shared-publication.js`, `src/utils/git-delivery.js`,
`templates/.specdev/_main.md`, and `templates/.specdev/workflows/`.
