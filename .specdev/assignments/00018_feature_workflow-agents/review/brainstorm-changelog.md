## Round 1

### Changes
- Addressed [F1.1] by revising the design to treat `templates/.specdev/` as the product source for agent specs, discoverability docs, project notes, and skill hints, while keeping `.specdev/...` paths as installed runtime paths resolved by commands.
- Addressed [F1.2] by specifying concrete runtime dependencies for structured metadata and validation: `yaml` for `agent.md` frontmatter parsing and `ajv` for output-schema and agent-spec meta-schema validation.

## Round 2

### Changes
- Addressed [F2.1] by adding the existing-installation path to the design: `src/utils/update.js` must copy the managed `agents` directory, `src/commands/update.js` must list `agents/` in dry-run/update output, and `tests/test-update.js` must verify `specdev update` backfills `.specdev/agents/researcher/agent.md`.

## Round 3

### Changes
- Addressed [F3.1] by adding an explicit runner prompt-transport contract (`append_arg`, `flag_arg`, and `stdin`), updating the researcher runner examples for Codex, Claude, and Cursor, and adding tests that assert rendered prompts reach spawned stub runners.
- Addressed [F3.2] by changing the artifact contract so stream-json runners write rendered markdown to the artifact and raw JSONL only to the sidecar, with a dedicated stream-json rendering test.

## Round 4

### Changes
- Addressed [F4.1] by adding safe `--context` handling: context paths resolve against the project, outside paths/traversal/symlink escapes and secret-looking files are rejected by default, `--unsafe-context` is required for explicit override, and context inclusion is capped at 64 KiB per file and 256 KiB total with truncation markers and tests.

## Round 5

### Changes
- Addressed [F5.1] by adding `tests/test-host-detection.js` for all successful and invalid host detection routes, adding a command-level `specdev research` test that relies on detected host state without `--platform`, and making `package.json` test-script updates explicit so the new tests run under `npm test`.

## Round 6

### Changes
- Addressed [F6.1] by adding `src/commands/dispatch.js` and `src/utils/commands.js` to the design, requiring `research` and `agents inspect` to be registered in the real CLI/help surfaces, and adding command-level tests that invoke `node bin/specdev.js` for both commands.

## Round 7

### Changes
- Addressed [F7.1] by making `targetDir` resolution explicit in `research.js`, passing `cwd: targetDir` into `runAgent`, requiring `agent-runner` to spawn child CLIs in that cwd, and adding a command-level `--target=<project>` test whose stub runner asserts the child process working directory is the target project.

## Round 8

### Changes
- Addressed [F8.1] by requiring `research.js` to build `specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)` before calling `runAgent`, updating the control-flow example to use that absolute target-anchored spec path plus `cwd: targetDir`, and broadening the `--target` command-level test to prove both target spec loading and target child cwd.

## Round 9

### Changes
- Addressed [F9.1] by removing `--json` from the Codex researcher runner example, keeping Codex on the plain stdout artifact path while Claude remains the stream-json runner with rendered markdown plus raw sidecar behavior.
- Addressed [F9.2] by removing `--out=<path>` from the v1 `specdev research` CLI surface instead of adding another path-resolution and safety contract to this assignment.

## Round 10

### Changes
- Addressed [F10.1] by making stdin prompt delivery the researcher default for Codex, Claude, and Cursor runner examples, keeping argv prompt modes only as generic small-prompt runner capabilities, and adding a max-sized 256 KiB context test that proves the child receives the full rendered prompt through stdin rather than oversized argv.
