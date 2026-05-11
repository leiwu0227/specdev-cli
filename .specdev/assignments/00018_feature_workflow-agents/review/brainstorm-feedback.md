## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] The design treats installed `.specdev/` workflow files as implementation targets instead of clearly making `templates/.specdev/` the product source. The design says the researcher "lives at `.specdev/agents/researcher/`" and lists `.specdev/_index.md` plus `.specdev/skills/core/brainstorming/SKILL.md` as modified files, with only a partial "mirror" under `templates/.specdev/` (`design.md:9`, `design.md:72-99`, `design.md:229-234`, `design.md:334-337`). In this repository, `AGENTS.md:5` explicitly says `.specdev/` is installed workflow/runtime state and SpecDev behavior changes must be made in `src/`, `templates/.specdev/`, tests, and docs. The real `init` command copies `templates/.specdev` into an installed `.specdev` tree (`src/commands/init.js:250-300`), so source changes made only under `.specdev/` would not ship to users and would also violate the repo rule. Please revise the directory layout, discoverability touchpoints, success criteria, and `AGENT_SPEC_PATHS` wording to identify `templates/.specdev/agents/researcher/agent.md`, `templates/.specdev/_index.md`, `templates/.specdev/project_notes/big_picture.md`, and `templates/.specdev/skills/core/brainstorming/SKILL.md` as the source files to edit, while still allowing runtime commands to resolve the installed `.specdev/...` paths in a user project.
2. [F1.2] The proposed `agent.md` frontmatter requires structured YAML parsing, but the design does not specify how that will be supported in the current package. The sketched spec uses nested objects and arrays such as `input.topic: { type: string, required: true }`, `output.schema`, and `runners.codex.args: [exec, --json]` (`design.md:151-168`). The existing frontmatter parser only handles a small custom subset and would parse those inline objects/arrays incorrectly or as strings (`src/utils/skills.js:1-63`), and `package.json` currently has no YAML or JSON Schema validation dependency beyond `fs-extra`. Since `agent-runner` and `agents inspect` both depend on strict frontmatter/schema validation (`design.md:111-119`, `design.md:225-227`, `design.md:341`), the design should choose and document one feasible path: add explicit dependencies such as a YAML parser and JSON Schema validator, or constrain `agent.md` frontmatter to the existing parser's supported subset and spell out the limited validation approach.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] The design now says `specdev init`/`update` installs `templates/.specdev/agents/researcher/` into each project's runtime `.specdev/agents/researcher/` tree, but it does not include the update command or update tests in the modified-file plan or success criteria (`brainstorm/design.md:9`, `brainstorm/design.md:72-104`, `brainstorm/design.md:338-341`). `init` will copy any new `templates/.specdev/agents` directory automatically because it copies the whole template tree (`src/commands/init.js:250-300`), but existing installations depend on `specdev update`, and `updateSpecdevSystem()` currently copies only `_main.md`, `_index.md`, `_guides`, `_templates`, `project_scaffolding/_README.md`, `skills/core`, `skills/README.md`, and official tool skills (`src/utils/update.js:58-68`). `src/commands/update.js` also advertises that same managed set in dry-run output and does not mention agents (`src/commands/update.js:28-33`). Without explicitly adding `agents` to the update path and a test that `specdev update` backfills `.specdev/agents/researcher/agent.md`, upgraded projects will get the new `specdev research` command and `AGENT_SPEC_PATHS.researcher` but no installed runtime spec, causing the command to fail outside fresh init projects. Please revise the design to include `src/utils/update.js`/`src/commands/update.js` and update coverage for backfilling the agents directory.

### Addressed from changelog
- [F1.1] Addressed: the revised design consistently identifies `templates/.specdev/...` as product source and `.specdev/...` as installed runtime state.
- [F1.2] Addressed: the revised design explicitly adds `yaml` and `ajv` as runtime dependencies and keeps the existing skill frontmatter parser out of agent parsing.

## Round 3

**Verdict:** needs-changes

### Findings
1. [F3.1] The runner design builds a prompt but never specifies how that prompt is delivered to the spawned CLI, and the sketched runner configs omit the per-platform prompt flags/arguments needed for the command to actually run non-interactively. `agent-runner` says it substitutes inputs into the prompt template, chooses `frontmatter.runners[platform]`, then spawns the subprocess (`brainstorm/design.md:115-123`, `brainstorm/design.md:223-228`), while the example configs are just `codex args: [exec, --json]`, `claude args: [--output-format, stream-json, --verbose]`, and `cursor args: [...]` (`brainstorm/design.md:171-174`). In the current working reviewloop configs, every external reviewer embeds the prompt directly in the command line, and Cursor specifically requires `-p`, Claude uses `--print`, and Codex receives the prompt as the `codex exec` argument (`templates/.specdev/skills/core/reviewloop/reviewers/codex.json:3`, `claude.json:3`, `cursor.json:3`). `runReviewerProcess()` only spawns the command with ignored stdin (`src/utils/reviewer-runner.js:55-58`), so simply lifting those mechanics without a defined prompt transport would produce CLIs that hang, exit usage errors, or run without the researcher prompt. Please revise the spec/runner contract to define prompt delivery explicitly, for example `prompt_arg: true`, `prompt_flag: -p`, or stdin support per runner, and add tests that assert the actual spawned argv/stdin contains the rendered topic/scope/context prompt for Codex, Claude, and Cursor stub runners.
2. [F3.2] The artifact contract conflicts with stream-json handling, which would make Claude output fail validation even when the agent produced valid markdown. The design says stream-json platforms get a `.jsonl` sidecar, but also says the runner captures "full raw output" to `artifactPath` and then parses required H2 sections plus the final fenced JSON block from that artifact (`brainstorm/design.md:121-123`, `brainstorm/design.md:227-228`, `brainstorm/design.md:325-327`). For Claude stream-json, the current implementation proves the needed shape is different: raw JSONL events are written to the sidecar while rendered assistant text is written to the human log (`src/utils/reviewer-stream-json.js:81-105`, `src/commands/reviewloop.js:286-302`). If the researcher artifact contains raw stream-json events, it will not contain literal `## Topic`/```json markdown in a parseable form. Please revise `agent-runner` to distinguish rendered artifact output from raw sidecar output for stream-json runners, and add a test with stream-json chunks that validates the artifact contains rendered markdown while the `.jsonl` contains raw events.

### Addressed from changelog
- [F2.1] Addressed: the revised design now includes `src/utils/update.js`, `src/commands/update.js`, and `tests/test-update.js` coverage for backfilling `.specdev/agents/researcher/agent.md` into existing installations.

## Round 4

**Verdict:** needs-changes

### Findings
1. [F4.1] The design adds `--context=<paths-csv>` and says those references are included verbatim in the researcher prompt, but it does not define any path validation, repo-boundary check, size cap, or secret-file guard before that content is sent to an external CLI that may also use web tools (`brainstorm/design.md:15-18`, `brainstorm/design.md:119`, `brainstorm/design.md:134-142`, `brainstorm/design.md:169`, `brainstorm/design.md:198-206`). This is a real secret-exposure risk: unlike the existing `reviewloop` path, which passes assignment/review file paths and environment metadata to a reviewer (`src/commands/reviewloop.js:215-288`), the proposed research command would intentionally read arbitrary caller-supplied context files and place their contents into an LLM prompt. A mistyped or prompt-injected invocation such as `--context=~/.ssh/id_rsa,.env` would leak credentials into the agent transcript/artifact and potentially into web-enabled reasoning. Please revise the design to resolve context entries against the target project, reject paths outside the project unless an explicit unsafe override is provided, deny common secret names by default (`.env`, key files, credential/token files), cap included bytes per file and total context bytes, and add tests for allowed repo paths, rejected traversal/absolute outside paths, rejected secret-looking paths, and truncation behavior.

### Addressed from changelog
- [F3.1] Addressed: the revised design now specifies explicit prompt transport modes (`append_arg`, `flag_arg`, `stdin`) and tests for rendered prompt delivery to stub runner invocations.
- [F3.2] Addressed: the revised design now separates rendered markdown artifacts from raw stream-json sidecars and adds stream-json rendering coverage.

## Round 5

**Verdict:** needs-changes

### Findings
1. [F5.1] The design introduces `host-detection.js` as a required path for default `specdev research` execution, but the test plan only covers `--platform` override and the no-marker error path, not the successful auto-detection routes (`SPECDEV_HOST_AGENT`, `CLAUDECODE`, `CODEX_HOME`, and Cursor's marker) (`brainstorm/design.md:146`, `brainstorm/design.md:152-160`, `brainstorm/design.md:348-356`). This is a real coverage gap because `research.js` resolves the platform through host detection before calling `runAgent`; if `SPECDEV_HOST_AGENT` parsing or one of the well-known marker mappings is wrong, the command can fail or select the wrong runner for normal users while all listed tests still pass via explicit `--platform`. Please add focused unit tests for `detectHostAgent()` covering precedence, each supported env/marker success case, invalid `SPECDEV_HOST_AGENT` values, and ambiguous marker behavior, plus at least one command-level test that runs `specdev research` without `--platform` using a stub-detected host.

### Addressed from changelog
- [F4.1] Addressed: the revised design now includes bounded, repo-scoped, secret-aware `--context` handling with tests for allowed files, rejected unsafe paths, symlink escape, unsafe override behavior, and truncation.

## Round 6

**Verdict:** needs-changes

### Findings
1. [F6.1] The design adds two user-facing CLI surfaces, `specdev research` and `specdev agents inspect <path>`, but it does not include the existing command registration/help surfaces in the modified-file plan or success criteria (`brainstorm/design.md:72-108`, `brainstorm/design.md:133-135`, `brainstorm/design.md:256-258`, `brainstorm/design.md:349-364`). In this CLI, commands are not discovered automatically from `src/commands/*.js`: `src/commands/dispatch.js` imports each command and explicitly registers `commandHandlers`, with special handling for subcommand groups such as `migrate` and `distill` (`src/commands/dispatch.js:1-46`, `src/commands/dispatch.js:48-99`). User-visible command listings also come from the separate `COMMANDS` array (`src/utils/commands.js:1-32`). If implementation follows the current design literally, `research.js` and `agents-inspect.js` can exist and unit tests for their internals can pass while `specdev research ...` returns `Unknown command: research`, and `specdev agents inspect ...` has no dispatcher path at all. Please revise the design to update `src/commands/dispatch.js` (including an `agents` subcommand dispatcher or equivalent), `src/utils/commands.js`/help output, and add command-level tests that invoke the real `bin/specdev.js` for `research` and `agents inspect` so the new surfaces are proven reachable.

### Addressed from changelog
- [F5.1] Addressed: the revised design now includes focused `detectHostAgent()` coverage for all supported success/error routes plus a command-level research test that relies on host auto-detection.

## Round 7

**Verdict:** needs-changes

### Findings
1. [F7.1] The research command resolves repo-relative context against `targetDir`, but the runner contract never says the spawned agent process runs with `cwd: targetDir`, and the success criteria do not test `specdev research ... --target=<project>` from outside the project. The design's runner call only passes `{ artifactPath, platform, maxRetries: 2 }` (`brainstorm/design.md:151`), while the runner responsibilities say only to "spawn the subprocess" (`brainstorm/design.md:128`). That leaves the child CLI in `process.cwd()` by default. This matters because the researcher prompt explicitly tells the child to inspect "the working tree" and `.specdev/` artifacts (`brainstorm/design.md:211-215`), and the existing reviewloop path already has to pass `cwd: targetDir` when spawning external CLIs (`src/commands/reviewloop.js:280-284`). Since `--target=<path>` is a documented global option (`src/commands/help.js:18-23`), running `specdev research "X" --target=/some/project` from another directory would write/read selected context from the target project but ask the external agent to research the wrong working tree. Please revise the design so `research.js` resolves `targetDir` via the standard command context, passes it to `runAgent`, `agent-runner` spawns with that cwd, and command-level tests cover a `--target` invocation from outside the project with a stub runner asserting `process.cwd()` is the target.

### Addressed from changelog
- [F6.1] Addressed: the revised design now includes `src/commands/dispatch.js` and `src/utils/commands.js` registration/help updates, with command-level tests invoking the real CLI for both `research` and `agents inspect`.

## Round 8

**Verdict:** needs-changes

### Findings
1. [F8.1] The design fixes the spawned agent's `cwd`, but still leaves the installed agent spec path relative to the caller's current working directory instead of the target project. `research.js` is specified to resolve `targetDir`, hardcode `SPEC_PATH = AGENT_SPEC_PATHS.researcher` as the runtime path `.specdev/agents/researcher/agent.md`, and call `runAgent(SPEC_PATH, ..., { artifactPath, platform, cwd: targetDir, maxRetries: 2 })` (`brainstorm/design.md:140-152`). `agent-runner` then "Read[s] `agent.md` at `specPath`" (`brainstorm/design.md:117-118`), with no rule that relative spec paths are resolved against `options.cwd`, and the later control-flow example repeats `runAgent(AGENT_SPEC_PATHS.researcher, ..., {artifactPath, platform, maxRetries: 2})` without target anchoring (`brainstorm/design.md:250-253`). In the current CLI, `--target` does not change `process.cwd()`; it only returns a path from `resolveTargetDir(flags)` (`src/utils/command-context.js:4-6`). So `node bin/specdev.js research X --target=/tmp/project` run from another directory can resolve context and artifact paths in `/tmp/project` while `runAgent('.specdev/agents/researcher/agent.md', ...)` attempts to read the caller directory's `.specdev`, or fails if none exists, before the child process cwd matters. Please revise the design so `research.js` passes an absolute spec path such as `join(targetDir, AGENT_SPEC_PATHS.researcher)` (or `agent-runner` explicitly resolves relative specs against `options.cwd` before reading), and broaden the `--target` command-level test to assert the loaded spec comes from the target project's `.specdev/agents/researcher/agent.md`, not only that the spawned child process has the target cwd.

### Addressed from changelog
- [F7.1] Partially addressed: the design now passes `cwd: targetDir` to `runAgent` and tests child process cwd, but the relative spec path itself is still not anchored to `targetDir`.

## Round 9

**Verdict:** needs-changes

### Findings
1. [F9.1] The Codex runner example enables JSONL event output but the runner contract only treats declared stream-mode runners as needing translation before validation. The design says plain stdout runners write stdout directly to the markdown artifact and only `stream_json` runners get assistant-text translation plus a raw `.jsonl` sidecar (`brainstorm/design.md:128-130`), while the researcher spec declares Codex as `args: [exec, --json]` without `stream_json: true` (`brainstorm/design.md:186-191`). `codex exec --help` confirms `--json` prints events to stdout as JSONL, and the existing Codex reviewloop config deliberately uses plain `codex exec ...` without `--json` (`templates/.specdev/skills/core/reviewloop/reviewers/codex.json:1-4`). As written, a successful Codex researcher response would be saved as raw event JSONL, so the artifact would not contain literal `## Topic` sections or a final fenced JSON block for the validator to parse. Please revise the Codex runner either to remove `--json` and use plain final-answer stdout, or to mark Codex as a stream/event runner and specify/test a Codex JSONL translator distinct from the Claude stream-json path.
2. [F9.2] The CLI surface advertises `--out=<path>`, but the design never defines how `--out` changes artifact path resolution or how it is validated. The only artifact rules cover the default `assignments/<id>/context/research-<slug>.md` path and collision suffixing (`brainstorm/design.md:137-143`), and the success criteria test only default output plus collision handling (`brainstorm/design.md:356-366`). This leaves implementation choices that affect real behavior: whether `--out` is target-relative or caller-CWD-relative, whether directories are created, whether existing files are overwritten or suffixed, whether paths outside `targetDir` are allowed, and whether secret/path safety rules mirror `--context`. Please either remove `--out` from the v1 CLI surface or add explicit `--out` semantics and command-level tests for target-relative resolution, existing-path behavior, and unsafe/outside-target paths.

### Addressed from changelog
- [F8.1] Addressed: the revised design now builds `specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)`, passes `cwd: targetDir`, and adds `--target` coverage for both target spec loading and child process cwd.

## Round 10

**Verdict:** needs-changes

### Findings
1. [F10.1] The prompt transport examples still pass potentially large rendered prompts as argv entries even though `--context` can inject up to 256 KiB of file content. The runner contract supports `append_arg`, `flag_arg`, and `stdin` (`brainstorm/design.md:124-127`), and the researcher examples use argv delivery for Codex, Claude, and Cursor (`brainstorm/design.md:187-201`). Separately, `research.js` allows 64 KiB per file and 256 KiB total context in the rendered prompt (`brainstorm/design.md:144-149`). That combination can fail before the agent starts with OS/Node argument-size errors, especially once the prompt template, environment, and shell/platform overhead are included. This is more likely for exactly the cases where `--context` is useful, and the current tests only assert that the rendered prompt reaches stub runners, not that a max-sized allowed prompt can be launched. Please revise the design so large prompts are delivered through a size-safe transport: either make stdin/file-based prompt delivery the researcher default for platforms that support it, or require `agent-runner` to switch away from argv above a documented byte threshold. Add coverage that runs with a max-sized allowed context block and proves the child receives it without relying on an oversized argv.

### Addressed from changelog
- [F9.1] Addressed: the revised design removes `--json` from the Codex runner example, keeping Codex on plain stdout while Claude remains the stream-json runner.
- [F9.2] Addressed: the revised design removes `--out=<path>` from the v1 CLI surface.
