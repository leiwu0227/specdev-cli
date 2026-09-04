# Workflow Engine

Parent design: `../core_concepts.md`

SpecDev uses versioned RippleGraph packages as its recoverable orchestration kernel.
Graph definitions describe semantic nodes, allowed transitions, external decisions,
action side channels, input/output schemas, and resumable position. The CLI supplies
domain meaning around those transitions.

Installation vendors supported graph packages into `.specdev/workflows/` and keeps
engine metadata in managed runtime. A focused run represents the one Assignment or
Mission scheduler. Isolated calls represent Discussions, Test Audits, maintenance
operations, and other callable workflows that may coexist because their ownership is
separate.

The generic engine can select a graph from intent, start or resume a run, display
state, submit typed decisions and node results, invoke allowed actions, and cancel a
generic workflow. Assignment and Mission lifecycles deliberately reject generic
advancement where a semantic command must enforce contracts, evidence, Git, or
review rules.

Adapter functions normalize RippleGraph state for commands and keep package loading,
checkpoint access, and synchronization behind a narrow boundary. Commands write
node output before advancing and verify that the resulting transition exists.
Missing packages, schema mismatch, unsupported historical state, or inconsistent
checkpoints fail closed with a recovery action.

```text
semantic command -> validate domain authority -> write typed node output
                 -> RippleGraph transition -> verify synchronized position
```

RippleGraph owns workflow position only. Human artifacts own approved intent and
durable conclusions; SpecDev commands own lane semantics; Git owns revisions and
delivery. Direct, Roadmap, and Adhoc remain graph-free because their interactions do
not need a recoverable multi-state lifecycle.

## Source Targets

- `src/commands/engine.js` — maximum 380 lines — generic engine-facing CLI operations.
- `src/utils/engine.js` — maximum 380 lines — package installation, discovery, and run access.
- `src/utils/engine-adapter.js` — maximum 140 lines — normalized engine state projection.
- `src/utils/engine-sync.js` — maximum 100 lines — verified semantic transitions.
- `src/utils/callable-sync.js` — maximum 80 lines — isolated callable lifecycle access.
