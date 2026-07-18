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
│   ├── proposal.md            (optional if design-only brainstorm)
│   └── design.md
├── breakdown/
│   └── plan.md
├── implementation/
│   ├── progress.json
│   └── implementation.md      (optional narrative)
├── context/
├── review_report.md           (present after final review)
└── review_request.json        (optional, review in progress)
```

## Validation Script

Validate an assignment folder against the schema:

```bash
node scripts/verify-assignment-schema.js .specdev/assignments/00001_feature_auth
```

The script reports:

1. required directory checks
2. detected highest phase
3. phase integrity for all completed phases
4. optional path presence warnings

## Change Policy

When changing workflow artifacts:

1. update `specdev.assignment-schema.json` first
2. run `node scripts/verify-assignment-schema.js <assignment-path>`
3. update docs/tests that reference affected paths

