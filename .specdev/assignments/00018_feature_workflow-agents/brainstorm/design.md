# Design: Introduce Agents as a SpecDev Workflow Primitive

## Overview

SpecDev's workflow today is built from two kinds of primitives: **skills** (prose protocols the host coding agent — Claude/Codex/Cursor — reads and follows) and **scripts** (deterministic mechanics like `setup-worktree.sh`). One reasoning workflow step already breaks this duality: `specdev reviewloop` spawns an external CLI as a reviewer, hands it inputs, and consumes its structured output. Reviewloop is, in effect, the workflow calling a *reasoning subroutine* — an agent — but the abstraction is private to review.

This assignment introduces **agents as a first-class workflow primitive**: a named, contract-bound reasoning tool the workflow (or the host agent) can call, distinct from scripts (deterministic) and skills (prose for the host). The first concrete agent is a **researcher** that takes a topic + scope and produces structured research notes covering the local repo, installed `.specdev/` knowledge, and the public web. The researcher is invokable two ways: explicitly via `specdev research "<topic>"`, and via skill hints (e.g., `brainstorming/SKILL.md` recommending it when the topic is unfamiliar).

We intentionally build one agent end-to-end before generalizing. Product source lives under `templates/.specdev/agents/researcher/` with an `agent.md` spec (advisory frontmatter + prompt body) and an `output-schema.json` sidecar (strict validation); `specdev init`/`update` installs those files into each project's runtime `.specdev/agents/researcher/` tree. Alongside it, `src/utils/agent-runner.js` ships as a general path-based subprocess runner — designed from day one to plausibly subsume `reviewer-runner.js` later, but **without** touching reviewloop in this assignment.

## Goals

1. **Establish "agent" as a named workflow primitive.** Introduce a single, documented concept — *agent: a reasoning subroutine the workflow calls* — with a clear contract (input, output, prompt, platform runners). Documented in the template source files `templates/.specdev/_index.md`, `templates/.specdev/project_notes/big_picture.md`, and a new `templates/.specdev/agents/README.md` so future maintainers and installed host agents discover it the same way they discover skills and scripts.

2. **Ship a working researcher agent end-to-end.** A `specdev research "<topic>" [--scope=...] [--context=...] [--platform=...] [--json] [--unsafe-context]` command that:
   - Packs a prompt from the spec template + caller-supplied topic + relevant local context.
   - Spawns an external CLI (codex/claude/cursor) via per-platform runner configs.
   - Captures full output into `assignments/<id>/context/research-<slug>.md` plus a sidecar JSONL for stream-mode platforms.
   - Strictly validates the agent's final JSON block against `output-schema.json` and retries up to 2 times on validation failure, with the validation error appended to the retry prompt.
   - Returns a stdout summary with exit code reflecting success/timeout/error.

3. **Cross-platform parity from day one.** The researcher must run on all three host platforms (Claude Code, Codex CLI, Cursor) via subprocess. No platform-specific in-session subagent dependency. Reuse the subprocess mechanics already proven in `reviewer-runner.js` (heartbeat, process-group timeout, capped capture).

4. **Make it discoverable, not just present.** Update `templates/.specdev/skills/core/brainstorming/SKILL.md` to mention the researcher as a recommended step when the topic is unfamiliar. List the researcher in `templates/.specdev/_index.md` under a new "Agents" section. Surface it via `specdev agents inspect <path>` and via `AGENT_SPEC_PATHS` in `workflow-contract.js`.

5. **Set up the path to generalization with a real module, not just intent.** `agent-runner` is shipped; `reviewer-runner` is left alone. Agent-runner's interface must be a credible superset of reviewer-runner's needs, demonstrated by a "subsumption check" mapping table reproduced as a structural test fixture (no actual migration).

## Non-Goals

1. **No reviewer-runner refactor.** We build `src/utils/agent-runner.js` as a general subprocess runner and the researcher uses it from day one. We do **not** refactor `src/utils/reviewer-runner.js` to use it — reviewloop's live behavior stays untouched. To keep the seam honest, the agent-runner design is validated against reviewer-runner's contract (heartbeat, process-group timeout, capped capture, stream-json sidecar, log envelope) as a design check; if agent-runner could not plausibly subsume reviewer-runner later, the design is wrong. The actual migration is a separate assignment.

2. **No `specdev call-agent` generic dispatcher and no agent registry.** The first cut ships exactly one CLI command — `specdev research` — with researcher-specific flags, plus a small debug command `specdev agents inspect <path>`. A generic `specdev call-agent <name>` dispatcher with name resolution is not built; **specs are referenced by path everywhere**.

3. **No new in-session subagent integration.** We do not use Claude's Task tool, Codex sub-task APIs, or Cursor's equivalents. Cross-platform parity means subprocess-only.

4. **No automatic invocation inside other commands.** No workflow command will auto-spawn the researcher. The researcher runs only when (a) a user types the command or (b) the host agent decides to invoke it after reading a skill hint.

5. **No new agent beyond the researcher.** Plan-critic, implementer, parallel-implement, and any specialized review agents are explicitly out of scope. The roadmap (below) documents what comes next, but nothing else ships here.

6. **No replacement of `parallel-worktrees`.** That skill stays as-is. The earlier discoverability gap is real but a separate refactor.

7. **No project-specific agent customization knobs.** No per-project agent override configs in v1.

8. **No persistence of researcher results across assignments.** Output lives in `assignments/<id>/context/`. Promoting findings into `knowledge/` remains a manual capture-phase decision.

## Design

### Agent spec format: Markdown Agent Spec

Distinct framing — this is **not** a Claude Code subagent file. It's a portable Markdown Agent Spec consumable by any host.

- Each agent source lives at `templates/.specdev/agents/<name>/` and is installed into user projects at `.specdev/agents/<name>/`. The installed runtime path is what `specdev research` resolves at execution time.
- Each agent directory contains at minimum `agent.md` (lowercase, intentionally departing from `SKILL.md` to visually mark agents as a different primitive).
- `agent.md` has YAML frontmatter (advisory) and a body (the prompt the agent receives).
- Strict contracts (output validation) live in **sibling files** (`output-schema.json`) — separate from advisory frontmatter so the "advisory vs strict" line is visible in the filesystem.
- **Specs are referenced by path, everywhere.** No global name registry, no name resolution. The spec's path is its identity.
- Frontmatter is parsed with the `yaml` npm package, not the existing lightweight skill frontmatter parser. Output schemas and the agent-spec meta-schema are validated with `ajv`. `package.json` adds both runtime dependencies in this assignment because structured nested YAML and JSON Schema validation are core behavior, not test-only tooling.

Frontmatter field status:

| Field | Status | Purpose |
|---|---|---|
| `description` | Required | One-line summary for discovery and trigger hints |
| `input` | Required | Prose-or-structured description of expected input — loose, host-agent-facing |
| `output.schema` | Required | Path to sidecar JSON Schema (the actual enforced contract) |
| `output.format` | Required | Prose hint about format shape, for the prompt |
| `tools` | **Advisory** | Recommended tools the agent expects to use. Documentation only; host permission system governs availability. |
| `model` | **Advisory** | Model recommendation. Omitting = "host default." Caller or runner config may override. |
| `runners` | Required for executable agents | Per-platform command, args, prompt transport, stream mode, and timeout. |
| `name` | Optional, descriptive only | Human label. **Not used for resolution.** |

### Directory layout (new and modified)

```
src/
├── commands/
│   ├── research.js            # New: thin command, hardcodes spec path, parses flags
│   ├── agents-inspect.js      # New: `specdev agents inspect <path>` debug command
│   ├── dispatch.js            # +wire `research` and `agents inspect`
│   └── update.js              # +dry-run/help text includes managed agents path
├── utils/
│   ├── agent-runner.js        # New: path-based subprocess runner with strict validation
│   ├── host-detection.js      # New: detect which host agent is invoking specdev
│   ├── commands.js            # +help/JSON command listing for new surfaces
│   ├── update.js              # +copy `agents` into existing installations
│   └── workflow-contract.js   # +AGENT_SPEC_PATHS runtime path constant

templates/.specdev/
├── _index.md                  # +Agents section listing installed researcher path
├── _templates/
│   └── agent-spec.schema.json # New: meta-schema for valid agent.md files
├── project_notes/
│   └── big_picture.md         # +Architecture bullet explaining agents
├── skills/core/
│   └── brainstorming/SKILL.md # +Researcher hint in Phase 1
└── agents/
    ├── README.md
    └── researcher/
        ├── agent.md
        └── output-schema.json # Source copied by `specdev init`/update

package.json                  # +runtime deps: yaml, ajv; +test scripts for new files

tests/
├── test-agent-runner.js
├── test-research.js
├── test-agents-inspect.js
├── test-host-detection.js
├── test-agent-runner-subsumption.js   # Structural pin against reviewer-runner capabilities
└── test-update.js                     # +backfills `.specdev/agents` on existing installs
```

### `agent-runner.js` — path-based, schema-validating subprocess runner

Signature: `runAgent(specPath, inputs, options) → { artifactPath, parsedOutput, exitCode, logs }`.

Responsibilities:
- Read `agent.md` at `specPath`. Parse frontmatter (advisory) and body (becomes the prompt template).
- Use `yaml` to parse frontmatter so nested objects, inline arrays, and runner configs work as written. Do not reuse `src/utils/skills.js`'s limited `parseFrontmatter()` helper.
- Resolve `output.schema` relative to the spec; load the JSON Schema once.
- Use `ajv` to validate the parsed final JSON block against `output-schema.json` and to validate `agent.md` metadata against `templates/.specdev/_templates/agent-spec.schema.json`.
- Substitute caller-provided `inputs` into the prompt template (simple `{{topic}}`, `{{scope}}`, `{{context}}` placeholders — no template engine, just string replace).
- Choose a runner from `frontmatter.runners[platform]`, allowing `options.platformOverride`.
- Deliver the rendered prompt according to the runner's explicit `prompt` contract:
  - `{ mode: append_arg }`: append the rendered prompt as the final argv entry.
  - `{ mode: flag_arg, flag: "-p" }`: append `flag` and the rendered prompt as two argv entries.
  - `{ mode: stdin }`: spawn with stdin piped, write the rendered prompt, then close stdin.
- For the researcher agent, use `stdin` prompt delivery on all platform runner entries because `--context` can make the rendered prompt much larger than safe argv limits. `append_arg` and `flag_arg` remain supported for future small-prompt agents and are tested independently with tiny stub prompts.
- Spawn the subprocess with `cwd: options.cwd` and require callers to pass the target project directory. Reuse the subprocess mechanics proven in `reviewer-runner.js`: process-group ownership, heartbeat output on parent activity (`markActivity()`), `SIGTERM` + 5s `SIGKILL` grace (grace timer unref'd), capped stdout capture, stream-json sidecar if the runner declares stream mode.
- Capture **rendered markdown output** to `options.artifactPath`. For plain stdout runners, rendered output is stdout. For stream-json runners, translate assistant text events into markdown before writing the artifact, and write raw stream-json lines to a `.jsonl` sidecar with matching basename.
- After process exit, locate the final fenced ` ```json ` block in the artifact, parse it, validate against the schema, and confirm the required H2 sections from the prompt are present.
- **Retry policy:** on validation failure, append a structured error description to the prompt and re-run, up to `options.maxRetries` (default 2). After exhaustion: non-zero exit, stderr summary, artifact preserved verbatim. **No salvage paths.**

`agent-runner.js` is generic. It does not know what a "researcher" is.

### `src/commands/research.js` — user-facing wrapper

CLI surface: `specdev research "<topic>" [--scope=repo|knowledge|web|all] [--context=<paths-csv>] [--platform=codex|claude|cursor] [--json] [--unsafe-context]`.

Responsibilities:
- Resolve `targetDir` via the standard command context (`resolveTargetDir(flags)`) before resolving assignments, context files, or output paths.
- Resolve the active assignment via the standard `.current` mechanism (error if none).
- Compute the artifact path. Default: `assignments/<id>/context/research-<slug>.md` with slug derived from topic (lowercase-hyphenated, capped at 40 chars).
- **Collision handling:** if the artifact path exists, append `-N` until free (`-2`, `-3`, …).
- Resolve `--context` entries before prompt construction:
  - Split CSV entries, trim empty entries, and resolve each path against `targetDir`.
  - Reject paths outside `targetDir` by default, including `..` traversal and absolute paths. `--unsafe-context` is required to include an outside path.
  - Reject secret-looking paths by default even inside the repo: `.env*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, and paths containing `credential`, `secret`, `token`, or `password`. `--unsafe-context` is required to include them.
  - Read only regular files. Directories, symlinks that resolve outside `targetDir`, and missing paths are clean errors.
  - Cap context inclusion at 64 KiB per file and 256 KiB total. Truncated files are marked in the rendered context block with original and included byte counts.
- Resolve platform via `host-detection.js` (see below), with `--platform` as override.
- Hardcode the runtime path constant from `workflow-contract.js` as `AGENT_SPEC_PATHS.researcher = '.specdev/agents/researcher/agent.md'`; the source file that ships it is `templates/.specdev/agents/researcher/agent.md`.
- Build `specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)` so `--target=<project>` loads the target project's installed agent spec, not the caller's current directory.
- Call `runAgent(specPath, { topic, scope, context }, { artifactPath, platform, cwd: targetDir, maxRetries: 2 })`.
- On success: print stdout summary (human or `--json` form), exit 0.
- On validation failure after retries: print stderr summary, exit non-zero. Artifact preserved.

### `src/utils/host-detection.js` — detect the calling host agent

`detectHostAgent({ flagOverride }) → 'codex' | 'claude' | 'cursor'` or throws.

Resolution order:
1. `flagOverride` if provided (always wins).
2. `SPECDEV_HOST_AGENT` env var (SpecDev's own contract; set by platform adapters at install/session-start).
3. Well-known platform markers: `CLAUDECODE` → claude; `CODEX_HOME` (or similar) → codex; Cursor's marker → cursor.
4. If none detected → throw with message: `"Could not detect host agent. Pass --platform=<claude|codex|cursor>."`

Refuse to silently guess — a wrong guess wastes a CLI session and tokens.

### `agent.md` — researcher spec (sketch)

Source path: `templates/.specdev/agents/researcher/agent.md`. Runtime path in an initialized project: `.specdev/agents/researcher/agent.md`.

```yaml
---
name: researcher
description: Researches a topic across the repo, .specdev knowledge, and the public web. Invoke when the topic is unfamiliar or evidence is thin.
input:
  topic:   { type: string, required: true }
  scope:   { type: enum, values: [repo, knowledge, web, all], default: all }
  context: { type: list,  optional: true, note: "file paths or .specdev refs to include verbatim" }
output:
  schema: ./output-schema.json
  format: "Markdown body with required H2 sections (Topic, Scope Used, Findings, Sources, Limitations), followed by a single fenced ```json block matching output-schema.json."
tools: [Read, Grep, Glob, Bash, WebSearch, WebFetch]   # advisory
model:                                                  # omitted → host default
runners:
  codex:
    command: codex
    args: [exec, -]
    prompt: { mode: stdin }
    timeout_ms: 300000
  claude:
    command: claude
    args: [--print, --input-format, text, --output-format, stream-json, --verbose]
    prompt: { mode: stdin }
    stream_json: true
    timeout_ms: 600000
  cursor:
    command: cursor-agent
    args: [-f, -p]
    prompt: { mode: stdin }
    timeout_ms: 300000
---

You are the SpecDev **researcher** agent. Your job is to gather information on a topic across multiple scopes and produce structured research notes that downstream workflow steps can consume.

## How input arrives

The caller provides a topic (required), an optional scope, and optional context references. Framing may be a strict list or natural language — be flexible about parsing.

## What to do

1. Read the topic and scope.
2. Investigate the assigned scopes:
   - `repo`: use Read/Grep/Glob on the working tree.
   - `knowledge`: use `specdev knowledge search "<query>"` plus direct reads of `.specdev/` artifacts.
   - `web`: use WebSearch/WebFetch for documentation and external references.
3. Synthesize findings, citing every source.
4. Produce output in the required format below.

## Output format

Your response MUST contain these H2 sections in order: `Topic`, `Scope Used`, `Findings`, `Sources`, `Limitations`.

After the markdown body, emit one fenced ```json block matching output-schema.json. The runner validates both — missing sections or invalid JSON will fail the call.
```

### `output-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["topic", "scope_used", "sources", "findings_word_count", "confidence", "status"],
  "properties": {
    "topic":              { "type": "string", "minLength": 1 },
    "scope_used":         { "type": "array", "items": { "enum": ["repo","knowledge","web"] }, "minItems": 1 },
    "sources":            { "type": "array", "items": {
        "type": "object", "required": ["type","ref"],
        "properties": { "type": { "enum": ["repo","knowledge","web"] }, "ref": { "type":"string" } } } },
    "findings_word_count":{ "type": "integer", "minimum": 0 },
    "confidence":         { "enum": ["high","medium","low"] },
    "status":             { "enum": ["ok","partial","failed"] }
  },
  "additionalProperties": false
}
```

### Control flow of one `specdev research "X" --scope=all` call

1. `research.js` resolves `targetDir`, assignment, context, and artifact path (applying `-N` if collision).
2. Resolves platform via `host-detection.js`.
3. Builds `specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)`.
4. Calls `runAgent(specPath, {topic, scope, context}, {artifactPath, platform, cwd: targetDir, maxRetries: 2})`.
5. `agent-runner` loads spec + schema, builds prompt, picks runner config, injects the prompt via the runner's explicit prompt transport, and spawns the subprocess with heartbeat + timeout in `cwd: targetDir`.
6. Subprocess writes stdout. Plain stdout is written directly to the markdown artifact; stream-json stdout is translated into rendered markdown for the artifact and preserved raw in a `.jsonl` sidecar.
7. On process exit: locate final ```json block, parse, validate against schema, check required H2 headers.
8. Valid → return `{ artifactPath, parsedOutput, exitCode: 0 }`. `research.js` prints summary.
9. Invalid → append validation error as a structured "your previous response was rejected because…" appendix and retry. Up to `maxRetries`. On final failure → non-zero exit with error details; artifact still written for debugging.

### `specdev agents inspect <path>` — debug command

Reads an `agent.md`, parses frontmatter with `yaml`, validates against the installed `.specdev/_templates/agent-spec.schema.json` (a meta-schema describing what a valid `agent.md` looks like), pretty-prints. Supports `--json`. Useful when authoring/debugging specs. Effectively free given the parser and `ajv` validator are already in `agent-runner.js`.

`src/commands/dispatch.js` must wire `research` as a top-level command and `agents inspect <path>` as an `agents` subcommand. `src/utils/commands.js` must list both surfaces so `specdev help` and `specdev help --json` expose them.

### Discoverability touchpoints

- `templates/.specdev/_index.md`: new top-level section "Agents" listing the installed researcher path with description.
- `templates/.specdev/project_notes/big_picture.md`: short bullet under Architecture introducing agents as a third primitive (alongside skills and scripts), with reviewloop noted as the proof-of-concept.
- `templates/.specdev/skills/core/brainstorming/SKILL.md`: short hint at the end of "Phase 1: Understand" — "If the topic is unfamiliar or knowledge search returns sparse results, run `specdev research \"<topic>\" --scope=all` (spec at `.specdev/agents/researcher/agent.md`)."
- `workflow-contract.js`: add `AGENT_SPEC_PATHS = { researcher: '.specdev/agents/researcher/agent.md' }` as a runtime path. Drift tests pin that the corresponding template source exists at `templates/.specdev/agents/researcher/agent.md` and that initialized projects receive the installed runtime path.
- `src/utils/update.js`: add `agents` to the managed system paths so `specdev update` copies `templates/.specdev/agents` into existing installations.
- `src/commands/update.js`: include `agents/` in dry-run and human update output so users can see the managed path.
- No new agent registry, no name resolution. Specs are referenced by path everywhere.

### Subsumption check (honesty about the seam)

Each `reviewer-runner` capability mapped to its `agent-runner` equivalent, to validate the new module *could* subsume reviewer-runner later:

| reviewer-runner | agent-runner equivalent |
|---|---|
| Heartbeat output on parent activity | Same; `markActivity()` is a runner-level concern, identical |
| Process-group `SIGTERM` + 5s `SIGKILL` grace, unref'd | Same primitive; lift verbatim |
| Capped stdout capture | Same primitive |
| Stream-json sidecar (Claude) | Same; per-platform spec entry declares stream mode |
| Per-reviewer JSON config | Per-platform entry in `agent.md` `runners` block — same shape, different location |
| Strict `## Round N` stdout salvage | **Not carried forward.** New agents fail loud; salvage was a back-compat concession. Reviewer migration (separate assignment) decides per-spec opt-in vs deletion. |
| Round-by-round feedback file | Replaced by retry-with-validation-error-appended; structurally similar |

The mapping identifies one explicit divergence (salvage) — that's the honest seam.

This table is reproduced as a structural test fixture in `tests/test-agent-runner-subsumption.js`: for each row, an assertion confirms the equivalent primitive exists on `agent-runner`'s public surface. The test does **not** execute reviewer migration; reviewer-runner is untouched.

### What this design does *not* include

(Reaffirming Non-Goals at the design level.)
- No `specdev call-agent` dispatcher; no agent registry.
- No reviewer-runner edits; no reviewloop edits.
- No second agent.
- No auto-invocation from any other command.
- No project-level agent overrides.

## Future Agents (Roadmap — not built in this assignment)

The next three agents are listed so the `agent-runner` abstraction is designed against real upcoming consumers, not speculation. Each is a separate follow-up assignment.

### 1. Reviewloop agent

**Role:** Phase-aware reviewer; replaces the existing reviewer subprocess pattern in `src/utils/reviewer-runner.js`.

**Why this is the next target.** It's the subsumption check we already committed to. Migrating reviewers to agents makes `agent-runner` the codebase's only subprocess runner and proves the abstraction.

**Stresses the abstraction in ways researcher does not:**
- Multi-round flow with accumulated state (per-round feedback files).
- Two output modes coexisting (stream-json for Claude, plain text for Codex/Cursor).
- Salvage policy boundary — decide per-spec opt-in (`frontmatter.output.salvage: true`) or fail-loud everywhere. Design `agent-runner` so this is a per-spec switch, not hardcoded.
- Per-round focus areas via caller-supplied `inputs.focus`.

**Likely shape.** Single `agent.md` per phase (`.specdev/agents/review-implementation/agent.md`, `.specdev/agents/review-brainstorm/agent.md`); the three reviewer flavors expressed as entries in the `runners` block. Today's `--reviewer=a,b,c` chain becomes "call the same spec multiple times with different `platform` overrides."

### 2. Workflow knowledge distill agent

**Role:** After an assignment completes, read `capture/` diffs, `review/` feedback, and `workflow_feedback/` notes; synthesize candidate entries for `knowledge/workflow/`.

**Why this is the right roadmap item.** Distillation is a recurring SpecDev pattern. `specdev distill` does heuristic JSON aggregation; the host then writes prose manually. Replacing the synthesis step with a reasoning agent removes manual burden and improves consistency. Also where the **proposal output pattern** first appears.

**Stresses the abstraction:**
- Large structured input context (whole assignment folder). The `context` input exercised harder than for researcher; possibly with glob/include directives.
- Proposal-style structured output: a list of proposed entries with `branch`, `path`, `action: create|update`, `body`, `merge_target`. The runner validates the list shape; a separate `specdev distill apply` command (out of scope here) interprets and writes files. **Runner stays side-effect-free.**
- Inter-artifact references in output. Validates that `output-schema.json` is expressive enough.

### 3. Codebase knowledge distill agent

**Role:** Same pattern as workflow distill, but targeting `knowledge/codestyle/`, `knowledge/architecture/`, `knowledge/domain/`. Reads recent assignments plus actual repo code; proposes durable codebase facts.

**Why this is on the roadmap.** Near-twin of workflow distill, which makes it a **convergence test**: if it can be built by mostly copying frontmatter, swapping the prompt, and changing the schema's `branch` enum — the abstraction is in good shape. If runner changes are needed, the abstraction is wrong and we fix it before going further.

**Stresses the abstraction:**
- Repo-wide scanning prompts (similar feel to researcher's `--scope=repo` but with synthesis output).
- Same proposal-style output as workflow-distill; validates schema reuse across two distillation targets.
- Cross-agent prompt patterns. If we end up extracting shared prompt fragments, that's its own design discussion later.

### What this roadmap commits us to

- **`agent-runner` must support** path-based dispatch, frontmatter parsing, prompt template substitution, strict output validation, retry-with-error, stream-json sidecars, capped capture, process-group timeout, and per-call retry/round count.
- **`agent-runner` must NOT bake in** salvage logic (per-spec opt-in instead), file-system side effects beyond artifact writes (agents propose; deterministic code applies), or name resolution (path-only).
- **What we still don't commit to:** schedules, exact prompts, deduplication algorithms, or whether the distill agents replace or supplement `specdev distill`. Each future assignment makes its own brainstorm.

## Success Criteria

The assignment is done when **all** of the following hold.

### Functional

1. **`specdev research "<topic>"` runs end-to-end on at least one host platform** and produces:
   - An artifact at `assignments/<id>/context/research-<slug>.md` containing the agent's markdown body with all five required H2 sections.
   - A final fenced ```json block in the artifact that parses and validates against `output-schema.json`.
   - Stdout summary (human or `--json` form).
   - Exit code 0.
2. **Output validation actually fails the call** when the agent emits malformed output. Test injects a deliberately broken stub response; confirms non-zero exit and preserved artifact.
3. **Retry-with-validation-error works.** Test forces one bad-then-good response cycle; confirms `maxRetries=2` recovers and final exit code is 0, and that the retry prompt contained the validation error from round 1.
4. **`--platform` flag overrides host detection.** Test runs with `--platform=codex` in an environment where `CLAUDECODE=1`; confirms codex runner config used.
5. **Host detection error is clean** when no platform marker is present and no flag passed. Test runs with sanitized env; confirms exit non-zero with the specified error message.
6. **Host detection success routes are covered.** `tests/test-host-detection.js` covers flag precedence, `SPECDEV_HOST_AGENT` values, `CLAUDECODE`, `CODEX_HOME`, Cursor marker detection, invalid `SPECDEV_HOST_AGENT` values, and ambiguous marker errors. `tests/test-research.js` includes at least one command-level run without `--platform` using a stub-detected host.
7. **Collision handling appends `-N`.** Test calls `specdev research` twice with the same topic in the same assignment; second artifact is `…-2.md`, both preserved.
8. **`specdev agents inspect <path>` parses a valid spec and exits 0.** With `--json`, output validates against the agent-spec meta-schema. Given a malformed `agent.md`, exits non-zero with a parse error message.
9. **Prompt transport is explicit and tested.** Stub runner tests cover the generic `append_arg`, `flag_arg`, and `stdin` delivery modes. Researcher command-level tests assert the rendered topic/scope/context prompt reaches spawned Codex, Claude, and Cursor stub invocations through stdin.
10. **Stream-json artifact rendering is tested.** A stream-json stub emits assistant text chunks; the raw `.jsonl` sidecar preserves those events while the markdown artifact contains rendered `## Topic` sections and a parseable final fenced JSON block.
11. **Context file inclusion is bounded and safe by default.** Tests cover an allowed repo file, rejected traversal/outside absolute paths, rejected secret-looking paths, symlink escape rejection, `--unsafe-context` override behavior, per-file truncation, and total context byte capping.
12. **`package.json` runs all new tests.** Add `test:agent-runner`, `test:research`, `test:agents-inspect`, `test:host-detection`, and `test:agent-runner-subsumption`, and include them in the aggregate `npm test` chain.
13. **New command surfaces are reachable through the real CLI.** `src/commands/dispatch.js` registers `research` and the `agents inspect` subcommand, `src/utils/commands.js` lists them for help output, and command-level tests invoke `node bin/specdev.js research ...` and `node bin/specdev.js agents inspect ...` rather than only calling module internals.
14. **`--target` controls the loaded spec and child agent working tree.** A command-level test invokes `node bin/specdev.js research ... --target=<project>` from outside that project with a stub runner, and the test asserts both that `research.js` loaded `<project>/.specdev/agents/researcher/agent.md` and that the child stub sees `process.cwd()` as the target project directory.
15. **Max-sized allowed context uses size-safe prompt transport.** A command-level test includes a 256 KiB allowed context block and proves the child stub receives the full rendered prompt through stdin, without depending on an oversized argv entry.

### Subsumption check (non-functional but load-bearing)

16. **The subsumption mapping table is reproduced as a test fixture** (`tests/test-agent-runner-subsumption.js`): for each reviewer-runner capability, an assertion confirms the equivalent agent-runner primitive exists on the runner's public surface. Structural pin only; reviewer-runner is untouched.

### Discoverability

17. **`templates/.specdev/_index.md`** includes an "Agents" section listing the researcher with description and installed runtime path.
18. **`templates/.specdev/project_notes/big_picture.md`** Architecture section has a bullet introducing agents as a third primitive, naming reviewloop as the proof-of-concept and researcher as the first formal agent.
19. **`templates/.specdev/skills/core/brainstorming/SKILL.md`** has a one-line hint in Phase 1 recommending `specdev research` when the topic is unfamiliar or knowledge search is sparse.
20. **`workflow-contract.js`** exports `AGENT_SPEC_PATHS` (single entry: researcher, runtime path `.specdev/agents/researcher/agent.md`). Drift tests confirm the template source exists, initializes into the runtime path, and the file parses.
21. **`specdev update` backfills agents for existing installations.** `src/utils/update.js` copies `agents`, `src/commands/update.js` lists `agents/` in dry-run output, and `tests/test-update.js` verifies an install missing `.specdev/agents/researcher/agent.md` receives it after update.

### Cross-platform

22. **The researcher's `agent.md` declares `runners` for all three platforms** with valid command/args/prompt/timeout fields. Smoke-tested via the `inspect` command parsing the spec; not required to actually run all three real CLIs in CI.

### Honesty about scope

23. **`src/utils/reviewer-runner.js` and `src/commands/reviewloop.js` are unchanged** (verified by git diff against main at the end of implementation).
24. **No second agent ships in this assignment.** Verified by listing `templates/.specdev/agents/*/agent.md` in source and `.specdev/agents/*/agent.md` in an initialized test project.
25. **No `specdev call-agent` command exists** and `agent-runner.js` is consumed only by `research.js` and the inspect command (verified by grep).

### Tests pass

26. **`npm test` passes** with all new test files included; no skipped tests, no `xfail`, no relaxed assertions vs main.
