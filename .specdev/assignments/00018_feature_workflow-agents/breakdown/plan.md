# Workflow Agents Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Introduce agents as a first-class SpecDev workflow primitive by shipping a path-based agent runner and one end-to-end researcher agent.

**Architecture:** Agent specs are product source under `templates/.specdev/agents/<name>/` and are installed into runtime projects at `.specdev/agents/<name>/`. `specdev research` resolves the installed researcher spec by target project path, calls a generic `agent-runner`, and stores validated markdown research artifacts in the active assignment's `context/` directory. The runner is path-based, schema-validating, subprocess-backed, and designed to preserve reviewer-runner's important process mechanics without changing reviewloop in this assignment.

**Tech Stack:** Node.js ESM, `fs-extra`, `yaml`, `ajv`, built-in `child_process`, existing test style with standalone Node scripts and `spawnSync`.

**Execution Mode:** inline

---

### Task 1: Install Agent Templates And Workflow Contract
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `package.json`, `package-lock.json`, `src/utils/workflow-contract.js`, `src/utils/update.js`, `src/commands/update.js`, `templates/.specdev/_index.md`, `templates/.specdev/project_notes/big_picture.md`, `templates/.specdev/skills/core/brainstorming/SKILL.md`; create `templates/.specdev/agents/README.md`, `templates/.specdev/agents/researcher/agent.md`, `templates/.specdev/agents/researcher/output-schema.json`, `templates/.specdev/_templates/agent-spec.schema.json`; modify tests `tests/test-workflow-contract-drift.js`, `tests/test-update.js`.

**Step 1: Write failing template/update contract tests**
Add assertions to `tests/test-workflow-contract-drift.js`:
```js
import {
  ASSIGNMENT_TYPES,
  REQUIRED_BRAINSTORM_SECTIONS,
  artifactPaths,
  commandPhases,
  AGENT_SPEC_PATHS,
} from '../src/utils/workflow-contract.js'

assert(AGENT_SPEC_PATHS.researcher === '.specdev/agents/researcher/agent.md', 'researcher runtime agent path is exported')
assert(read('templates/.specdev/agents/researcher/agent.md').includes('name: researcher'), 'researcher agent template exists')
assert(read('templates/.specdev/agents/researcher/output-schema.json').includes('"scope_used"'), 'researcher output schema exists')
assert(read('templates/.specdev/_templates/agent-spec.schema.json').includes('"runners"'), 'agent spec meta-schema exists')
assert(read('templates/.specdev/_index.md').includes('Agents'), '_index.md documents agents')
assert(read('templates/.specdev/skills/core/brainstorming/SKILL.md').includes('specdev research'), 'brainstorming skill hints at researcher')
```

Add an update backfill case to `tests/test-update.js`:
```js
console.log('\nupdate backfills agents:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
rmSync(join(TEST_DIR, '.specdev', 'agents'), { recursive: true, force: true })
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds without existing agents directory')
assert(existsSync(join(TEST_DIR, '.specdev', 'agents', 'researcher', 'agent.md')), 'researcher agent backfilled')
assert(result.stdout.includes('agents'), 'human update output mentions agents')

result = runCmd(['update', `--target=${TEST_DIR}`, '--dry-run', '--json'])
const dryRun = JSON.parse(result.stdout)
assert(dryRun.would_update.some(value => value.includes('agents')), 'dry-run JSON lists agents')
```

**Step 2: Run tests to verify they fail**
Run: `npm run test:workflow-contract-drift && npm run test:update`
Expected: FAIL because `AGENT_SPEC_PATHS`, agent templates, meta-schema, and update backfill do not exist yet.

**Step 3: Add dependencies, templates, and update plumbing**
Run: `npm install yaml ajv --save`

Add to `src/utils/workflow-contract.js`:
```js
export const AGENT_SPEC_PATHS = {
  researcher: '.specdev/agents/researcher/agent.md',
}
```

Add `agents` to `systemPaths` in `src/utils/update.js`.

Add `agents/` to `wouldUpdate` in `src/commands/update.js` so human and JSON dry-run output mention it.

Create `templates/.specdev/agents/README.md`:
```md
# Agents

Agents are contract-bound reasoning subroutines that SpecDev commands can call through external CLIs. They are distinct from skills, which are instructions for the host coding agent, and scripts, which are deterministic mechanics.

Specs are referenced by path. The first shipped agent is `researcher/agent.md`.
```

Create `templates/.specdev/agents/researcher/agent.md` with the researcher spec from the brainstorm design. Use stdin prompt delivery for all runners:
```yaml
---
name: researcher
description: Researches a topic across the repo, .specdev knowledge, and the public web. Invoke when the topic is unfamiliar or evidence is thin.
input:
  topic: { type: string, required: true }
  scope: { type: enum, values: [repo, knowledge, web, all], default: all }
  context: { type: list, optional: true, note: "file paths or .specdev refs to include verbatim" }
output:
  schema: ./output-schema.json
  format: "Markdown body with required H2 sections (Topic, Scope Used, Findings, Sources, Limitations), followed by a single fenced json block matching output-schema.json."
tools: [Read, Grep, Glob, Bash, WebSearch, WebFetch]
runners:
  codex:
    command: codex
    args: [exec, "-"]
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

You are the SpecDev **researcher** agent.

## Topic

{{topic}}

## Scope

{{scope}}

## Context

{{context}}

## What to do

Investigate the assigned scopes:
- `repo`: inspect the working tree.
- `knowledge`: use `specdev knowledge search "<query>"` plus direct reads of `.specdev/` artifacts.
- `web`: use web documentation and external references when available.

Your response MUST contain these H2 sections in order: `Topic`, `Scope Used`, `Findings`, `Sources`, `Limitations`.

After the markdown body, emit one fenced ```json block matching `output-schema.json`.
```

Create `templates/.specdev/agents/researcher/output-schema.json` with draft-07 schema requiring `topic`, `scope_used`, `sources`, `findings_word_count`, `confidence`, and `status`.

Create `templates/.specdev/_templates/agent-spec.schema.json` validating `description`, `input`, `output.schema`, `output.format`, and `runners.*.command/args/prompt/timeout_ms`.

Update `templates/.specdev/_index.md`, `templates/.specdev/project_notes/big_picture.md`, and `templates/.specdev/skills/core/brainstorming/SKILL.md` with the exact discoverability bullets from the design.

**Step 4: Run tests to verify they pass**
Run: `npm run test:workflow-contract-drift && npm run test:update`
Expected: PASS.

**Step 5: Commit**
Run:
```sh
git add package.json package-lock.json src/utils/workflow-contract.js src/utils/update.js src/commands/update.js templates/.specdev tests/test-workflow-contract-drift.js tests/test-update.js
git commit -m "Add agent templates and workflow contract"
```

### Task 2: Build The Generic Agent Runner
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/utils/agent-runner.js`; modify or create `tests/test-agent-runner.js`; possibly create `src/utils/agent-stream-json.js` only if sharing the existing reviewer translator directly would couple agent behavior to reviewer naming.

**Step 1: Write failing runner tests**
Create `tests/test-agent-runner.js` with standalone tests matching existing style. Include helpers for temp agent specs and fake spawned children. Required cases:
```js
console.log('\nagent runner parses and validates spec:')
// valid agent.md with YAML frontmatter and output-schema.json loads successfully.

console.log('\nagent runner prompt transports:')
// append_arg appends rendered prompt as final argv entry.
// flag_arg appends flag plus rendered prompt.
// stdin pipes rendered prompt, closes stdin, and does not put the prompt in argv.

console.log('\nagent runner validation and retry:')
// first child output omits required JSON, retry prompt includes validation error, second output passes.

console.log('\nagent runner stream-json artifact:')
// stream_json true writes raw .jsonl sidecar and rendered markdown artifact.

console.log('\nagent runner process mechanics:')
// cwd is passed to spawn, timeout sends SIGTERM then SIGKILL grace, stdout capture is capped.
```

Use fake spawn injection like `tests/test-reviewloop-runner.js`; do not run real external CLIs.

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-agent-runner.js`
Expected: FAIL because `src/utils/agent-runner.js` does not exist.

**Step 3: Implement `src/utils/agent-runner.js`**
Export:
```js
export async function runAgent(specPath, inputs, options = {}) {}
export function renderPrompt(template, inputs) {}
export function extractFinalJsonBlock(markdown) {}
export function validateRequiredSections(markdown, sections) {}
```

Implementation requirements:
- Parse frontmatter with `yaml`.
- Validate frontmatter with `ajv` against `templates/.specdev/_templates/agent-spec.schema.json`.
- Resolve `output.schema` relative to `specPath`.
- Render `{{topic}}`, `{{scope}}`, `{{context}}` with simple replacement.
- Select runner from `frontmatter.runners[options.platform]`.
- Support prompt modes `append_arg`, `flag_arg`, and `stdin`.
- Spawn `runner.command` with `runner.args`, not through a shell string.
- Use `cwd: options.cwd`, `env: options.env || process.env`, `detached: true`.
- Pipe stdin only for `prompt.mode === 'stdin'`.
- Preserve process-group timeout behavior from `reviewer-runner.js`.
- For `stream_json`, write raw stdout to `<artifactPath>.jsonl` and rendered assistant text to `artifactPath`.
- For plain output, write stdout directly to `artifactPath`.
- Validate required H2 sections and the final fenced JSON block after each run.
- Retry up to `options.maxRetries ?? 2`, appending a concise validation error section to the next prompt.

**Step 4: Run test to verify it passes**
Run: `node ./tests/test-agent-runner.js`
Expected: PASS.

**Step 5: Commit**
Run:
```sh
git add src/utils/agent-runner.js tests/test-agent-runner.js
git commit -m "Add generic agent runner"
```

### Task 3: Add Research Command, Host Detection, And CLI Wiring
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/utils/host-detection.js`, `src/commands/research.js`; modify `src/commands/dispatch.js`, `src/utils/commands.js`, `src/commands/help.js` if needed; create `tests/test-host-detection.js`, `tests/test-research.js`.

**Step 1: Write failing host and research tests**
Create `tests/test-host-detection.js` covering:
```js
assert(detectHostAgent({ flagOverride: 'codex' }, { CLAUDECODE: '1' }) === 'codex', 'flag override wins')
assert(detectHostAgent({}, { SPECDEV_HOST_AGENT: 'claude' }) === 'claude', 'SPECDEV_HOST_AGENT claude works')
assert(detectHostAgent({}, { CLAUDECODE: '1' }) === 'claude', 'CLAUDECODE detects claude')
assert(detectHostAgent({}, { CODEX_HOME: '/tmp/codex' }) === 'codex', 'CODEX_HOME detects codex')
assert(detectHostAgent({}, { CURSOR_TRACE_ID: 'abc' }) === 'cursor', 'cursor marker detects cursor')
assertThrowsInvalidSpecdevHostAgent()
assertThrowsAmbiguousMarkers()
```

Create `tests/test-research.js` covering:
- `node bin/specdev.js research "agent docs" --platform=codex --target=<project>` creates `context/research-agent-docs.md`.
- Malformed stub output exits non-zero and preserves artifact.
- Bad-then-good stub output retries and exits 0.
- Duplicate topic creates `research-agent-docs-2.md`.
- No `--platform` succeeds when host detection env selects a stub platform.
- `--target=<project>` from a different cwd loads `<project>/.specdev/agents/researcher/agent.md` and child stub sees `process.cwd()` equal to target project.
- Safe context file is included.
- Outside path, traversal, secret-looking path, symlink escape, missing file, and directory are rejected by default.
- `--unsafe-context` allows explicit outside/secret paths.
- Per-file and total context caps produce truncation markers.
- A 256 KiB allowed context reaches the child through stdin, not argv.

Use a temporary project initialized with `node bin/specdev.js init --target=<project>`, create an assignment folder and `.specdev/.current`, then replace the installed researcher `agent.md` runner commands with Node stub scripts under the temp project.

**Step 2: Run tests to verify they fail**
Run: `node ./tests/test-host-detection.js && node ./tests/test-research.js`
Expected: FAIL because command and host detection do not exist.

**Step 3: Implement host detection and research command**
`src/utils/host-detection.js`:
```js
const VALID = new Set(['codex', 'claude', 'cursor'])
export function detectHostAgent({ flagOverride } = {}, env = process.env) {
  if (flagOverride) return validate(flagOverride)
  if (env.SPECDEV_HOST_AGENT) return validate(env.SPECDEV_HOST_AGENT)
  const markers = []
  if (env.CLAUDECODE) markers.push('claude')
  if (env.CODEX_HOME) markers.push('codex')
  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR_SESSION_ID) markers.push('cursor')
  const unique = [...new Set(markers)]
  if (unique.length === 1) return unique[0]
  if (unique.length > 1) throw new Error(`Ambiguous host agent markers: ${unique.join(', ')}`)
  throw new Error('Could not detect host agent. Pass --platform=<claude|codex|cursor>.')
}
```

`src/commands/research.js`:
- Resolve `targetDir` with `resolveTargetDir(flags)`.
- Resolve active assignment from `.specdev/.current`.
- Slug topic to max 40 chars.
- Compute default artifact path under `<assignment>/context`.
- Resolve and include context files with the safety rules from the design.
- Build `specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)`.
- Call `runAgent(specPath, { topic, scope, context }, { artifactPath, platform, cwd: targetDir, maxRetries: 2 })`.
- Print human summary or JSON.

Wire `research` in `src/commands/dispatch.js` and list it in `src/utils/commands.js`. Add help workflow text only if needed to make human help discoverable.

**Step 4: Run tests to verify they pass**
Run: `node ./tests/test-host-detection.js && node ./tests/test-research.js`
Expected: PASS.

**Step 5: Commit**
Run:
```sh
git add src/utils/host-detection.js src/commands/research.js src/commands/dispatch.js src/utils/commands.js src/commands/help.js tests/test-host-detection.js tests/test-research.js
git commit -m "Add research command and host detection"
```

### Task 4: Add Agent Inspect Command
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/commands/agents-inspect.js`, `tests/test-agents-inspect.js`; modify `src/commands/dispatch.js`, `src/utils/commands.js`.

**Step 1: Write failing inspect tests**
Create `tests/test-agents-inspect.js` covering:
```js
// node bin/specdev.js agents inspect <valid-agent.md> exits 0 and prints name/description/schema.
// --json output parses and includes command: "agents inspect", name, description, runners.
// malformed frontmatter exits non-zero with a parse/validation error.
// missing path exits non-zero.
// real template researcher agent validates through inspect.
```

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-agents-inspect.js`
Expected: FAIL because `agents inspect` is not wired.

**Step 3: Implement inspect command**
`src/commands/agents-inspect.js` should:
- Accept `positionalArgs[0] === 'inspect'`.
- Resolve the following path argument relative to `targetDir` unless absolute.
- Reuse the agent spec loader/validator from `agent-runner.js`.
- Print human summary or JSON.

Update `src/commands/dispatch.js` with an `agents` subcommand branch:
```js
if (command === 'agents') {
  await agentsInspectCommand(positionalArgs, flags)
  return
}
```

Update `src/utils/commands.js` with `agents inspect`.

**Step 4: Run test to verify it passes**
Run: `node ./tests/test-agents-inspect.js`
Expected: PASS.

**Step 5: Commit**
Run:
```sh
git add src/commands/agents-inspect.js src/commands/dispatch.js src/utils/commands.js tests/test-agents-inspect.js
git commit -m "Add agent inspect command"
```

### Task 5: Add Subsumption Pin, Test Scripts, And Final Verification
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `tests/test-agent-runner-subsumption.js`; modify `package.json`, `package-lock.json`; inspect git diff for `src/utils/reviewer-runner.js` and `src/commands/reviewloop.js`.

**Step 1: Write failing subsumption and package-script checks**
Create `tests/test-agent-runner-subsumption.js`:
```js
import { readFileSync } from 'node:fs'

let failures = 0
let passes = 0
function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ } else { console.log(`  PASS ${msg}`); passes++ }
}

const runner = readFileSync('src/utils/agent-runner.js', 'utf-8')
assert(runner.includes('markActivity'), 'agent-runner supports heartbeat activity')
assert(runner.includes('SIGTERM') && runner.includes('SIGKILL'), 'agent-runner supports process-group termination grace')
assert(runner.includes('stdoutBufferLimit') || runner.includes('appendCapped'), 'agent-runner supports capped stdout capture')
assert(runner.includes('stream_json'), 'agent-runner supports stream-json sidecar behavior')
assert(runner.includes('runners') && runner.includes('platform'), 'agent-runner selects per-platform runner config')
assert(!runner.includes('## Round'), 'agent-runner does not bake in reviewloop salvage')
assert(runner.includes('maxRetries'), 'agent-runner supports retry rounds')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

Add package script expectations by manually checking `package.json` after update:
- `test:agent-runner`
- `test:research`
- `test:agents-inspect`
- `test:host-detection`
- `test:agent-runner-subsumption`
- Aggregate `npm test` includes all of them.

**Step 2: Run tests to verify they fail**
Run: `node ./tests/test-agent-runner-subsumption.js`
Expected: FAIL until `agent-runner` exposes all required primitives.

**Step 3: Update package scripts and adjust runner surface only if needed**
Modify `package.json` scripts:
```json
"test:agent-runner": "node ./tests/test-agent-runner.js",
"test:research": "node ./tests/test-research.js",
"test:agents-inspect": "node ./tests/test-agents-inspect.js",
"test:host-detection": "node ./tests/test-host-detection.js",
"test:agent-runner-subsumption": "node ./tests/test-agent-runner-subsumption.js"
```

Insert these into the aggregate `test` chain before `test:cleanup`.

If the subsumption test reveals missing public primitives, adjust `src/utils/agent-runner.js` directly rather than loosening the test.

**Step 4: Run focused and full verification**
Run:
```sh
npm run test:agent-runner
npm run test:host-detection
npm run test:research
npm run test:agents-inspect
npm run test:agent-runner-subsumption
npm test
git diff -- src/utils/reviewer-runner.js src/commands/reviewloop.js
find templates/.specdev/agents -name agent.md -print
```
Expected:
- All tests PASS.
- `git diff -- src/utils/reviewer-runner.js src/commands/reviewloop.js` prints no diff.
- Only `templates/.specdev/agents/researcher/agent.md` is listed.

**Step 5: Commit**
Run:
```sh
git add package.json package-lock.json tests/test-agent-runner-subsumption.js src/utils/agent-runner.js
git commit -m "Verify agent runner contract"
```

### Task 6: Implementation Completion Check
**Mode:** full
**Skills:** test-driven-development, verification-before-completion
**Files:** Modify only files needed to fix integration issues found by full verification.

**Step 1: Verify implementation progress and full test suite**
Run:
```sh
specdev status --json
npm test
git status --short
```
Expected:
- `npm test` passes.
- Worktree shows only intended product source, tests, docs/templates, package files, and assignment workflow artifacts.

**Step 2: Confirm success criteria explicitly**
Run:
```sh
node bin/specdev.js help --json | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const j=JSON.parse(s); if(!j.commands.some(c=>c.name==='research')) process.exit(1); if(!j.commands.some(c=>c.name==='agents inspect')) process.exit(1);})"
node bin/specdev.js agents inspect templates/.specdev/agents/researcher/agent.md --json
git diff --quiet -- src/utils/reviewer-runner.js src/commands/reviewloop.js
```
Expected: all commands exit 0.

**Step 3: Commit any final fixes**
Run:
```sh
git add .
git commit -m "Complete workflow agents implementation"
```
Only commit if there are remaining changes from this task.
