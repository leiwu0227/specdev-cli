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

### Make a bounded edit

```bash
specdev adhoc start "repair one help message"
# make the change
specdev adhoc finish \
  --outcome="Corrected the help text" \
  --verification="Inspected the CLI output"
```

Adhoc work skips the contract and review loop but still records one receipt and
one final Git commit.

### Deliver an approved change

```bash
specdev assignment "repair keyword search"
# collaborate on the generated brainstorm/contract.md
specdev checkpoint brainstorm
specdev reviewloop brainstorm   # optional
specdev approve brainstorm
specdev implement
```

Approval is bound to the exact contract. Implementation records evidence and
uses the configured worker and reviewer profiles.

### Run a larger mission

```bash
specdev mission create "repair search end to end"
specdev mission run M00001
specdev mission run M00001 --approve
specdev mission status M00001
specdev mission land M00001
```

A Mission runs on its own branch and can coordinate already-independent work
while preserving durable checkpoints.

## Learn more

See [QUICKSTART.md](QUICKSTART.md) for an end-to-end walkthrough, or run:

```bash
specdev help
```

## License

MIT
