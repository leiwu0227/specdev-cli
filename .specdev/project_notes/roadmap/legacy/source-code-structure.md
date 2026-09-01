# Product Source Structure

Status: implemented

## Current layout

```text
specdev-cli/
├── bin/
│   └── specdev.js          executable entry point
├── src/
│   ├── commands/           public CLI handlers and orchestration
│   └── utils/              reusable mechanisms and feature modules
├── templates/
│   └── .specdev/           managed runtime source installed in projects
├── hooks/                  packaged coding-agent integrations
├── tests/                  repository-only behavior verification
├── docs/                   repository-only supporting documentation
└── package.json            npm package and shipped-file boundary
```

## Decision

SpecDev's product source has these responsibilities:

- **`bin/specdev.js`** is the executable boundary. It starts argument parsing
  and command dispatch; workflow and repository behavior does not live there.
- **`src/commands/`** owns public CLI handlers and top-level command
  orchestration. It connects commands and subcommands to reusable mechanisms
  and presents their results to the user.
- **`src/utils/`** owns reusable mechanisms and feature modules, including
  durable state, workflow integration, Git delivery, knowledge, publication,
  and bounded provider adapters. Command modules depend on these modules;
  utility modules must not import from `src/commands/` or `bin/`.
- **`templates/.specdev/`** is the canonical managed-runtime source installed by
  `specdev init` and maintained by `specdev update`. It may contain declarative
  workflows, guides, skills, seed state, and bounded skill helper scripts, but
  it is not a second Node.js implementation of the CLI, and its installed copy
  is managed runtime rather than a product-authoring location.
- **`hooks/`** contains packaged integrations. Hooks use supported SpecDev CLI
  interfaces for authoritative queries and operations. They may make bounded
  read-only filesystem probes to produce advisory compatibility context for an
  older or incomplete installation, but such probes are not canonical state and
  may not mutate, advance, approve, deliver, or recover a workflow.

`tests/` verifies command boundaries and reusable mechanisms. Documentation and
other repository-only development or release inputs support the product but are
not runtime layers. Such support roots may be added, regrouped, or removed
without an architecture change. The shipped npm boundary remains explicit in
`package.json`.

This decision binds runtime-layer responsibilities, dependency direction, and
authority boundaries, not the exact file inventory or a permanently flat
layout. Related files may be grouped into subdirectories as the codebase grows,
and ordinary feature modules may be added within these boundaries without an
architecture change.

Introducing a new peer runtime layer, reversing the command-to-utility
dependency direction, moving Node.js CLI implementation into installed
`.specdev/` state, making a hook's private-layout probe authoritative or capable
of workflow mutation, or making repository-only support content necessary for
runtime execution requires explicit user notification and approval as an
architecture change.

## Verification

Aligned at Git revision `b914ca602c8884f214df87d3fcf5202321a72004`
against `package.json`, `bin/specdev.js`, `src/commands/dispatch.js`,
`src/utils/cli.js`, `src/utils/commands.js`,
`src/utils/shared-publication.js`, `src/commands/init.js`,
`src/commands/update.js`, `templates/.specdev/`, and `hooks/session-start.sh`.
