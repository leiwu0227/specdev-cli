# CLI Interface

Parent design: `../core_concepts.md`

The `specdev` executable is a thin, provider-neutral command interface over semantic
workflow operations. It parses process arguments, dispatches one public command, and
renders stable human or JSON output without becoming a second workflow engine.

The executable entry installs top-level error handling and delegates immediately to
the CLI parser. Parsing separates the command, positional arguments, Boolean flags,
and value flags while preserving explicit user input. Dispatch owns command routing
and cross-lane admission; individual commands own semantic validation.

The command catalog is the canonical help inventory. Human output is concise and
action-oriented, with deterministic sections, bullets, paths, identities, and next
actions. Machine output uses versioned JSON payloads and does not require consumers
to scrape decorative text. Errors set a nonzero exit status and explain the safe
recovery action without exposing internal stack traces during ordinary use.

Public compatibility is defined by command names, supported flags, payload fields,
exit behavior, and durable side effects. Internal utility boundaries may evolve
without changing that contract. Aliases or legacy commands must be explicit and
cannot bypass semantic gates.

The CLI runs directly on Node.js ESM with no transpilation or build step. Package
metadata binds the `specdev` binary to `bin/specdev.js`, declares the supported Node
version, and limits shipped roots. Output helpers remain presentation-only and never
decide workflow state.

## Source Targets

- `bin/specdev.js` — maximum 30 lines — executable process boundary.
- `src/utils/cli.js` — maximum 70 lines — argument parsing and top-level invocation.
- `src/commands/help.js` — maximum 80 lines — human command catalog presentation.
- `src/utils/output.js` — maximum 60 lines — shared text-formatting helpers.
- `src/utils/commands.js` — maximum 140 lines — canonical public command metadata.
