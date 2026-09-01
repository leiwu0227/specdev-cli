# Source Code Folder Structure

## Purpose

The SpecDev repository layout separates the shipped Node.js CLI, the managed
runtime installed into target repositories, packaged agent integrations,
tests, and repository-only support material. The structure exists to keep
authority clear: product behavior belongs in source code, installed workflow
guidance belongs in templates, and project-specific runtime state belongs only
in the consuming repository's `.specdev/` directory.

This note describes stable layout responsibilities rather than a permanent file
inventory. Files may move within these boundaries as the implementation grows.

## Problem Example

SpecDev develops a tool that itself installs `.specdev/` workflow files into
other repositories. Without a clear source layout, it is easy for agents to edit
the installed runtime copy as if it were product source, add CLI behavior inside
templates, or make hooks depend on private state shape instead of supported CLI
interfaces.

That confusion breaks the durable responsibility model. Git still records a
change, but the change may have landed in the wrong authority layer, making the
product hard to update, test, package, or reinstall consistently.

## Design

### Executable Boundary

`bin/specdev.js` is the thin executable boundary. It starts the CLI process and
hands control to command dispatch. It should not own workflow semantics,
durable state rules, or command-specific behavior.

Keeping the executable thin makes the package entry point stable while allowing
the implementation behind it to evolve.

### Command Layer

`src/commands/` owns public CLI command handlers and top-level orchestration.
Commands interpret user intent, select reusable mechanisms, shape output, and
enforce command-level boundaries.

Commands may coordinate multiple lower-level modules, but they should not
become alternate storage, workflow, provider, or packaging systems. Their role
is to present product capabilities through explicit user-facing operations.

### Reusable Mechanism Layer

`src/utils/` owns reusable mechanisms and feature modules: durable state access,
workflow integration, Git delivery helpers, knowledge support, provider
adapters, and other shared behavior. Utility modules support commands and may
support each other through stable local contracts.

Dependency direction flows from executable to commands to reusable mechanisms.
Reusable mechanisms must not import command modules or depend on executable
entry behavior. This preserves reuse, testability, and clear ownership.

### Managed Runtime Source

`templates/.specdev/` is the canonical source for managed runtime files
installed by `specdev init` and maintained by `specdev update`. It may contain
workflow guides, skills, seed state, declarative assets, and bounded helper
scripts used by installed agent environments.

Templates are not a second Node.js CLI implementation. They describe and
support repository-local SpecDev behavior, while product logic that creates,
updates, validates, or interprets them remains in the CLI source.

### Packaged Integrations

`hooks/` contains packaged integrations for coding-agent environments. Hooks
use supported SpecDev CLI interfaces for authoritative queries and operations.
They may make bounded compatibility probes when an installation is old or
incomplete, but private layout probing is advisory and must not mutate or
advance workflow state.

### Repository Support Roots

`tests/`, `docs/`, and similar support roots help develop, verify, and explain
the product. They are not runtime authority layers. The shipped package
boundary remains explicit in `package.json`.

## Design Choices and Tradeoffs

- The layout favors authority boundaries over perfect domain grouping.
- Source code owns behavior; templates own installed guidance and seed runtime
  assets; target repositories own live `.specdev/` state.
- Dependency direction stays one-way from entry point to commands to reusable
  mechanisms.
- Hooks and installed skills integrate through supported CLI surfaces instead
  of becoming independent workflow engines.
- Adding, regrouping, or removing repository support roots is ordinary
  evolution. Adding a new runtime authority layer, reversing dependencies, or
  moving CLI behavior into templates requires explicit architecture approval.
