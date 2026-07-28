# SpecDev CLI

SpecDev turns coding-agent work into a durable, reviewable engineering
workflow. It keeps scope, approvals, implementation evidence, and recovery
state alongside your code in a tracked `.specdev/` directory. Work stays
inspectable, restartable, and portable across agents and machines.

Choose the lightest workflow that fits the job:

- **Direct** for questions and read-only inspection.
- **Adhoc** for one small, bounded edit.
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

## Examples

In normal use, you do not drive SpecDev by memorizing commands. Tell your coding
agent what you want in natural language. The agent discusses scope and
approvals with you, then runs the workflow commands. The snippets below show
what the agent does behind the scenes.

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
approve the exact final version. From there, `specdev implement` switches to
automatic execution. A worker plans and implements the change, acceptance
evidence is collected, a reviewer checks the delivery, and SpecDev records the
outcome and final commit.

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

## Learn more

See [QUICKSTART.md](QUICKSTART.md) for an end-to-end walkthrough, or run:

```bash
specdev help
```

## License

MIT
