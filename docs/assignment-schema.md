# Assignment Artifacts

SpecDev deliberately has no second generalized Assignment schema. Lifecycle
shape belongs to the versioned `assignment-lifecycle` RippleGraph package, while
small command-level validators check the few durable artifacts that need a
mechanical contract.

## Current Canonical Structure

```text
.specdev/assignments/<id>_<slug>/
├── brainstorm/
│   └── contract.md
├── design/
│   └── plan.md
├── implementation/
│   └── progress.json
├── review/                     (created only when review runs)
├── outcome.md
├── unsupported.md              (only for terminal unsupported conclusions)
└── status.json
```

`brainstorm/contract.md` carries inline acceptance IDs such as `AC-1`.
`design/plan.md` maps ordered Task IDs to them. `outcome.md` contains the compact
final acceptance/evidence/result table.

`unsupported.md` is the canonical negative-result artifact when an approved
standalone Assignment is explicitly closed as unsupported. Its matching
`status.json` record preserves the approved contract hash, reason, evidence
digests, source lifecycle, repository parent, exact owned manifest, and closure
plan. The artifact and all tracked runtime/focus effects are published in one
`unsupported-terminal` commit; the commit hash is derived from Git rather than
written into its own tree.

Required sections are authority boundaries, not invitations to repeat the
repository's big picture. Keep each section to change-specific information (or
state that none exists), and use the fewest independent observable acceptance
criteria—normally 1-3 for a small Assignment and rarely more than 5. Tasks and
file lists belong in `design/plan.md`.

## Validation

```bash
specdev checkpoint brainstorm
specdev implement
```

The Brainstorm checkpoint checks contract sections, remaining placeholders, and
acceptance IDs. Implementation validates Task coverage, guide selections and
their catalog versions, verification receipts, structured deviations,
`follow_up`, and final results before the frozen review policy is applied.

Review policy is stored in `status.json` while Brainstorm is editable and copied
into the exact approval decision. Supported values are Brainstorm
`optional|required` and implementation `required|waived`. A waiver is valid only
for all-Passed acceptance/evidence with no deviations or follow-up.

## Change Policy

When changing workflow artifacts:

1. version and update `templates/.specdev/workflows/assignment-lifecycle/graph.json`
2. update only the narrow validator that owns the changed invariant
3. update docs and focused tests that reference affected paths
