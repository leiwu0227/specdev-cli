# Source Code Folder Structure

## Product Layout

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

## Responsibilities

- **`bin/specdev.js`** is the executable boundary. It starts argument parsing and command dispatch; workflow and repository behavior does not live there.
- **`src/commands/`** owns public CLI handlers and top-level command orchestration. It connects commands and subcommands to reusable mechanisms and presents their results to the user.
- **`src/utils/`** owns reusable mechanisms and feature modules, including durable state, workflow integration, Git delivery, knowledge, and bounded provider adapters. Command modules depend on these modules; utility modules must not import from `src/commands/` or `bin/`.
- **`templates/.specdev/`** is the canonical managed-runtime source installed by `specdev init` and maintained by `specdev update`. It may contain declarative workflows, guides, skills, seed state, and bounded skill helper scripts. It is not a second Node.js implementation of the CLI, and its installed copy is managed runtime rather than a product-authoring location.
- **`hooks/`** contains packaged integrations. Hooks use supported SpecDev CLI interfaces for authoritative queries and operations. They may make bounded read-only filesystem probes to provide advisory compatibility context for an older or incomplete installation, but such probes are not canonical state and may not mutate, advance, approve, deliver, or recover a workflow.
- **`tests/`** verifies command boundaries and reusable mechanisms.

Documentation and other repository-only development or release inputs support the product but are not runtime layers. Such support roots may be added, regrouped, or removed without an architecture change. The shipped npm boundary remains explicit in `package.json`.

## Dependency and Evolution Rules

Runtime dependencies flow from the executable boundary through command orchestration to reusable utility mechanisms. Installed `.specdev/` state and hooks interact with the CLI through supported interfaces rather than becoming alternate implementations.

This design binds runtime-layer responsibilities, dependency direction, and authority boundaries—not the exact file inventory or a permanently flat layout. Related files may be grouped into subdirectories as the codebase grows, and ordinary feature modules may be added within these boundaries without an architecture change.

The following require explicit user notification and approval as architecture changes:

- Introducing a new peer runtime layer.
- Reversing the command-to-utility dependency direction.
- Moving Node.js CLI implementation into installed `.specdev/` state.
- Making a hook’s private-layout probe authoritative or capable of workflow mutation.
- Making repository-only support content necessary for runtime execution.
