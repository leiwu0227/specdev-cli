# Assignment Schema

SpecDev uses a single authoritative assignment schema file:

- `specdev.assignment-schema.json`

This file defines:

1. required top-level directories for every assignment
2. ordered workflow phases
3. per-phase artifact rules (`mode: all` or `mode: any`)
4. optional-but-recommended paths

## Current Canonical Structure

```text
.specdev/assignments/<id>_<type>_<name>/
├── brainstorm/
│   ├── proposal.md
│   └── design.md
├── breakdown/
│   └── plan.md
├── implementation/
│   ├── progress.json
│   └── implementation.md      (optional narrative)
├── context/
├── review/                    (per-phase feedback/changelog and reviewer logs)
└── status.json                (gate state)
```

## Validation

The canonical validator is the CLI:

```bash
specdev checkpoint <phase>
```

`specdev checkpoint` consumes `specdev.assignment-schema.json` via
`src/utils/assignment-schema.js` and reports required directory checks,
detected highest phase, phase integrity for completed phases, and optional
path presence warnings.

`scripts/verify-assignment-schema.js` is a low-level test utility that
covers the same checks for `tests/test-assignment.js`. It is not the
primary entry point for day-to-day validation.

## Change Policy

When changing workflow artifacts:

1. update `specdev.assignment-schema.json` first
2. run `specdev checkpoint <phase>` (and `node scripts/verify-assignment-schema.js <assignment-path>` for the test utility check)
3. update docs/tests that reference affected paths
