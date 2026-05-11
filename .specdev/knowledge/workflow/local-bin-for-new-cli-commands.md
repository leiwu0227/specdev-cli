# How should new CLI commands be verified before the global specdev binary is updated?

## Short Answer
Use `node ./bin/specdev.js <command>` from the repo when verifying commands added in the current working tree. The globally installed `specdev` may not include newly added commands until the package is installed or updated.

## Applies When
- Developing `specdev-cli` itself.
- A new command has been added in `src/commands/dispatch.js`.
- Verification fails with `Unknown command: <name>` even though the local source has the command.

## Example
Use:

```sh
node ./bin/specdev.js next --json
```

instead of:

```sh
specdev next --json
```

until the local CLI changes have been installed.

## Source
- Assignment: 00021_familiarization_workflow-review
- Phase: implementation
