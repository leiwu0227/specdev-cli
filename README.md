# SpecDev CLI

SpecDev turns coding-agent work into a durable, reviewable engineering
workflow. It keeps scope, approvals, implementation evidence, and recovery
state alongside your code in a tracked `.specdev/` directory. Work stays
inspectable, restartable, and portable across agents and machines.

Choose the lightest workflow that fits the job:

- **Direct** for questions, read-only inspection, and small non-behavioral
  documentation writes with no workflow state, receipt, or automatic commit.
- **Adhoc** for one explicitly selected bounded edit with a receipt and final
  commit.
- **Assignment** for a contracted change with approval, implementation, and review.
- **Mission** for a larger objective coordinated across multiple assignments.

## Install

Node.js 22.13 or newer is required.

```bash
npm install -g github:leiwu0227/specdev-cli
specdev init
```

Refresh an existing installation with:

```bash
specdev update
```

If stale SpecDev clauses remain in a platform adapter, the command returns a
durable operation and an exact `specdev update --operation=UPD00001` resume
command. `specdev update --status` lists interrupted operations; dry-run never
creates one.

## Examples

In normal use, you do not drive SpecDev by memorizing commands. Tell your coding
agent what you want in natural language. The agent discusses scope and
approvals with you, then runs the workflow commands. The snippets below show
what the agent does behind the scenes.

### Ask for a small documentation artifact

> Write an HTTP usage manual under project notes.

The agent announces once, reads only the destination instructions and facts the
manual needs, writes it, and checks it narrowly. This is Direct when it records
existing behavior: it creates no SpecDev state, receipt, or automatic commit.
A handoff note explicitly requested in another repository follows the same
Direct path while honoring that destination's instructions. Documentation that
changes product behavior or a public contract still needs a governed lane.

### Ask for a bounded edit

> Fix the confusing help text. Keep this as a small Adhoc change.

The agent runs:

```bash
specdev adhoc start "repair one help message"
# the agent makes the change
specdev adhoc finish \
  --outcome="Corrected the help text" \
  --verification="Inspected the CLI output"
```

Adhoc work skips the contract and review loop but still records one receipt and
one final Git commit.

### Ask for an approved change

> Keyword search is broken. Create an Assignment and work with me on the
> contract before implementing it.

The agent runs:

```bash
specdev assignment "repair keyword search"
# the agent collaborates with you on brainstorm/contract.md
specdev checkpoint brainstorm
specdev reviewloop brainstorm   # optional
# after you explicitly approve the contract
specdev approve brainstorm
specdev implement
```

An Assignment begins with an interactive brainstorm: you and the coding agent
shape a readable contract, an optional reviewer can challenge it, and you
approve the exact final version. From there, `specdev implement` freezes the
execution owner at the Git boundary. The default `auto` mode keeps standalone
Design and Implementation in the foreground coding session; rerunning the
command validates its delivery artifacts and starts an independent review.
Set `implementation.mode: spawned` in `.specdev/agents.yaml` (or use
`--spawned --execution-reason="..."` before the boundary) for unattended worker
execution. Mission-controlled children always remain spawned. Both paths keep
the same acceptance evidence, review, recovery, delivery receipt, and final
commit guarantees.

### Ask for a larger mission

> Use a Mission to repair search end to end. Keep it running through the
> approved work and preserve progress if the session is interrupted.

The agent runs:

```bash
specdev mission create "repair search end to end"
specdev mission run M00001
# after you explicitly approve the Mission contract
specdev mission run M00001 --approve
specdev mission status M00001
specdev mission land M00001
```

Missions are designed for long-running executions that may outlive one agent
session. A Mission runs on its own branch, advances a durable assignment queue,
and checkpoints its progress so interrupted work can resume safely. Independent
children may run concurrently; final verification and landing bring the
integrated result back to the base branch.

Before approval, Mission output includes one contract-bound execution policy:
worker and reviewer profiles, the exact verification executable and command,
required capabilities, services, platforms, and secret names, approved executor
classes, and every explicit bypass or escalation. Capability facts live in
`.specdev/executors.yaml`; secret values are never stored there or in receipts.

Verification receipts retain executor and candidate provenance. A confirmed
executor-only blockage may use one approved alternate while keeping the exact
command and candidate. Later passing evidence links to, rather than overwrites,
the blocked attempt. Successful child and wave boundaries create recoverable
checkpoints, and convergence refuses uncheckpointed product changes.

An explicitly planned `execution: evidence-only` child succeeds by recording
its exact authorized observation, even when that observation is negative. The
failed receipt remains visible while the queue records
`completed-with-follow-up` and returns control to Mission gap resolution.

An active Mission already blocked inside such a historical child can inspect a
reviewed standalone repair without mutation:

```bash
specdev mission adopt-successor M00001 --assignment=00042
```

Apply only the unchanged content-addressed plan by rerunning the printed command
with `--confirm=<snapshot>`. Adoption preserves the failed child, requires exact
candidate, command, policy, cleanup, review, and provenance identities, and
replays the passing receipt without rerunning verification.

If an evidence-only problem has already terminalized a Mission, keep that
history immutable and draft a fresh approval boundary with:

```bash
specdev mission handoff M00001 --successor-assignment
```

## Learn more

See [QUICKSTART.md](QUICKSTART.md) for an end-to-end walkthrough, or run:

```bash
specdev help
```

## License

MIT
