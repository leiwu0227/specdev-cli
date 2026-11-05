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

## Operation scopes

SpecDev uses RippleGraph's `withGraphOperationScope` to reuse validated graph
packages across a bounded sequence of related engine operations. The sequence
belongs to one command invocation and one workflow root. For example, a command
can read the current position, apply a permitted transition, and verify the new
position within one scope.

The command owns the scope lifetime. Adapters explicitly forward its context to
participating engine operations. They preserve ordinary unscoped calls through
the same implementation path. Contexts do not become global state, durable
workflow data, or a separate execution model. Existing adapters remain the
integration boundary; scoped reuse does not require new classes or a SpecDev
package cache.

A scope ends when its bounded sequence completes or fails. It must end before
waiting for user input, an external agent, or another long-running external
operation. Resumed work opens a fresh scope. Contexts cannot cross workflow roots,
command invocations, or completed scope boundaries. The command awaits scope
completion; individual engine operations retain their existing synchronous
behavior.

Reuse applies to unchanged package parsing and validation. RippleGraph retains
package freshness checks and handles changed or failed package loads. SpecDev
continues to read current workflow state and enforce domain authority at each
required boundary. Registry data, checkpoints, approvals, Git evidence, and
persistence do not become cached authority. A scope is neither a transaction nor
a lock and does not change transition ordering, failure recovery, or durable
history. Returned data retains its existing ownership and mutation guarantees.

Adopt scopes where related operations repeatedly load the same packages. Do not
wrap every isolated engine call or hold a scope for an entire Mission. Measure
representative command sequences before broadening adoption. Compare elapsed
time and package validation work with unscoped execution, and check that simple
commands do not materially regress. Preserve outputs, errors, side effects, and
fresh-state decisions. Upstream benchmarks alone do not establish a SpecDev
performance improvement.

## Source Targets

- `src/commands/engine.js` — maximum 380 lines — generic engine-facing CLI operations.
- `src/utils/engine.js` — maximum 380 lines — package installation, discovery, and run access.
- `src/utils/engine-adapter.js` — maximum 140 lines — normalized engine state projection.
- `src/utils/engine-sync.js` — maximum 100 lines — verified semantic transitions.
- `src/utils/callable-sync.js` — maximum 80 lines — isolated callable lifecycle access.
