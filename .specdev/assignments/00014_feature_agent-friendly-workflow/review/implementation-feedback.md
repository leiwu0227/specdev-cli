# Review: 00014_feature_agent-friendly-workflow — Implementation

## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] **CRITICAL: Full test suite does not pass.** `npm test` currently exits 1 in `tests/test-init.js` while reading `tests/test-init-output/.claude/settings.json` during the hook registration idempotency/merge coverage. The assignment progress says all tasks are complete, but implementation approval requires the full suite to pass or a documented, accepted reason why it cannot. The failing command was `npm test`; the assignment-specific tests (`test:knowledge`, `test:context`, `test:json-simple`, `test:json-medium`, `test:hook`) pass.
2. [F1.2] **CRITICAL: `implement --json` omits the planned `tasks` array.** The design and breakdown specify `implement --json` should return `{ assignment, plan_path, tasks: [...], execution_mode }`, but `src/commands/implement.js:41` only emits `task_count`. That leaves agents unable to consume the task list from JSON, which is the main purpose of this command’s machine-readable output. The test was also weakened to assert `task_count` instead of the planned `tasks` array, so it will not catch the contract regression.
3. [F1.3] **CRITICAL: Several command JSON payloads drift from the documented contract.** The design specifies `review` should include `review_session_started`, `skills install` should include `skill`, `installed`, and `path`, and `skills sync` should include `synced`, `created`, and `removed`. The implementation instead emits `review` metadata without `review_session_started` in `src/commands/review.js:149`, `skills_installed`/`agents`/`total_tools` in `src/commands/skills-install.js:112`, and `removed`/`regenerated`/`inactive` in `src/commands/skills-sync.js:68`. Either the implementation should match the design, or the design/tests should be updated before approval so agents have a stable JSON contract.
4. [F1.4] **MINOR: Hook still says knowledge files are “indexed” when it only counts discovered files.** `hooks/session-start.sh:121` sets `KNOWLEDGE_COUNT` from `ctx.knowledge.files.length`, but the emitted message at `hooks/session-start.sh:123` says “files indexed.” That repeats the ambiguity flagged in brainstorm review: discovered knowledge files and SQLite indexed documents are separate concepts in `context --json`.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] **CRITICAL: `update --dry-run --json` still emits human prose instead of JSON.** The design's first success criterion is that every command accepts `--json` and returns structured output, and `update` is one of the explicitly listed commands. In `src/commands/update.js:28`, the dry-run branch returns before the `flags.json` handling at `src/commands/update.js:84`, so `specdev update --dry-run --json` prints sectioned text with emoji bullets. That leaves agents unable to safely preflight update operations, which is one of the cases where dry-run output is most useful. Add a JSON branch for the dry-run path and cover it in `tests/test-json-medium.js` or `tests/test-update.js`.
2. [F2.2] **CRITICAL: Remaining tool-skill JSON payloads still drift from the planned machine contract.** Round 1 flagged this, but `skills install --json` now emits `{ skills, installed, agents, total_tools }` at `src/commands/skills-install.js:112` without the planned installed skill/path information, and `skills sync --json` still emits `{ removed, regenerated, inactive }` at `src/commands/skills-sync.js:68` instead of the planned `{ synced, created, removed }`. The changed tests assert the implementation-specific shape rather than the design contract, so a consumer following `brainstorm/design.md` or `breakdown/plan.md` would still break. Either align the payloads with the design, or revise the design/tests together so the contract is intentional and documented.

### Addressed from changelog
- [F1.1] Accepted as environment-specific after re-running: `npm test` now passes in this review session.
- [F1.2] Fixed: `implement --json` now returns a `tasks` array.
- [F1.3] Partially fixed: `review --json` now includes `review_session_started`, but tool-skill JSON contract drift remains as F2.2.
- [F1.4] Fixed: the hook now says knowledge files are available, not indexed.

## Round 3

**Verdict:** needs-changes

### Findings
1. [F3.1] **CRITICAL: Several advertised commands still ignore `--json`, so the universal JSON success criterion is not met.** `brainstorm/design.md` says "Every command accepts `--json` and returns structured output" and lists that as success criterion 1, but commands still present in `src/utils/commands.js` emit human text when invoked with `--json`. For example, `specdev init --json` prints the normal success prose because `src/commands/init.js:274` and the rest of the success path call `console.log` unconditionally; `specdev start --json` prints prose only in `src/commands/start.js:17`; `specdev reviewloop implementation --json` without `--reviewer` prints the reviewer selection prose from `src/commands/reviewloop.js:430`; and `specdev --version --json` still prints a bare version string in `src/commands/dispatch.js:80`. Agents relying on the documented universal contract still have to special-case these commands, and the new tests only cover the subset added in the breakdown. Either add JSON branches for the remaining advertised commands, or revise the design/success criteria to explicitly scope which commands are machine-consumable.

### Addressed from changelog
- [F2.1] Fixed: `update --dry-run --json` now emits structured JSON with `dry_run`, `would_update`, and `preserved`.
- [F2.2] Fixed enough for the intended contract: `skills install --json` now returns per-skill installed entries with `skill`, `path`, and `wrappers`; `skills sync --json` now returns `synced` and `removed` arrays. The additional `available_not_installed` field is compatible and useful.

### Verification
- `npm test` passed.
- `node tests/test-json-medium.js` passed.
- `node tests/test-json-simple.js` passed.
- `node tests/test-context.js && node tests/test-knowledge.js && node tests/test-hook.js` passed.

## Round 4

**Verdict:** needs-changes

### Findings
1. [F4.1] **CRITICAL: `init --json` still emits prose before JSON, so consumers cannot parse it.** Round 3 flagged `init --json` as part of the universal JSON contract, but the current success path still logs setup messages before the JSON branch. For a fresh target, `node ./bin/specdev.js init --json --target=/tmp/specdev-review-init-json` prints lines such as `✅ Created CLAUDE.md`, `✅ Installed 9 skills...`, and `✅ Registered SessionStart hook...` before the JSON object, because `src/commands/init.js:301`, `src/commands/init.js:331`, and the skill-install block at `src/commands/init.js:343` run before the `flags.json` handling at `src/commands/init.js:348`. This is not just a cosmetic issue: `JSON.parse(stdout)` fails, so agents cannot safely use `init --json` despite the advertised "Every command accepts `--json`" success criterion. Suppress or collect human logs while `flags.json` is set, and add a test that parses the entire stdout from `init --json`.
2. [F4.2] **CRITICAL: Remaining advertised commands still ignore `--json` instead of returning structured output.** The Round 3 changelog explicitly rejected `start` and `--version`, but the design and success criteria were not revised to narrow the contract. These commands are still advertised through `src/utils/commands.js`, yet `node ./bin/specdev.js start --json --target=/mnt/h/oceanwave/lib/specdev-cli` prints the raw project-context prose from `src/commands/start.js:17`, and `node ./bin/specdev.js --version --json` prints only `0.0.4` from `src/commands/dispatch.js:80`. A consumer following `specdev context --json` or `specdev help --json` still has to special-case those entries. Either implement JSON envelopes for them or update the design/command metadata to make the supported JSON surface explicit.

### Addressed from changelog
- [F3.1] Partially addressed: `reviewloop <phase> --json` without `--reviewer` now returns a structured reviewer list. `init --json` was attempted but still produces invalid JSON because earlier setup logs are emitted first. `start --json` and `--version --json` remain unresolved unless the design is narrowed.

### Verification
- `node ./bin/specdev.js init --json --target=/tmp/specdev-review-init-json` produced non-JSON stdout before the JSON object.
- `node ./bin/specdev.js --version --json` produced a bare version string.
- `node ./bin/specdev.js start --json --target=/mnt/h/oceanwave/lib/specdev-cli` produced human prose.
- `node tests/test-json-simple.js && node tests/test-json-medium.js && node tests/test-context.js && node tests/test-knowledge.js && node tests/test-hook.js` passed.

## Round 5

**Verdict:** needs-changes

### Findings
1. [F5.1] **CRITICAL: `reviewloop <phase> --json` without `--reviewer` still emits prose before JSON.** Round 3 called out this command and the changelog says it was fixed, but `src/commands/reviewloop.js:431` prints `Reviewloop: ...`, `src/commands/reviewloop.js:432` prints the phase, and `src/commands/reviewloop.js:433` prints a blank line before the JSON branch at `src/commands/reviewloop.js:460`. Repro: `node ./bin/specdev.js reviewloop implementation --json --target=/mnt/h/oceanwave/lib/specdev-cli` exits 0 but stdout begins with human text, so `JSON.parse(stdout)` fails. Move the human header below the `flags.json` branch and add a test that parses the entire stdout for this listing path.
2. [F5.2] **CRITICAL: `init --dry-run --json` ignores `--json` and prints human dry-run prose.** The narrowed design still includes `init` in the JSON-capable command surface, and dry-run mode is a natural automation path for setup checks. `src/commands/init.js:246` returns from the dry-run branch before the JSON suppression/output path starts at `src/commands/init.js:254`. Repro: `node ./bin/specdev.js init --dry-run --json --target=$(mktemp -d)` exits 0 and prints `Dry run mode - would copy` text, not structured JSON.

### Addressed from changelog
- [F4.1] Fixed for normal successful `init --json`: a fresh target now emits clean JSON only.
- [F4.2] Accepted as a design-scope change for `start` and `--version`: the design now explicitly excludes `start`, and says agents should use `context --json` instead of `--version --json`.

### Verification
- `node ./bin/specdev.js reviewloop implementation --json --target=/mnt/h/oceanwave/lib/specdev-cli` produced human prose before the JSON object.
- `node ./bin/specdev.js init --dry-run --json --target=$(mktemp -d)` produced human prose.
- `node tests/test-json-simple.js` passed.
- `node tests/test-json-medium.js` passed.
- `node tests/test-context.js && node tests/test-knowledge.js && node tests/test-hook.js` passed.
- `node tests/test-reviewloop-command.js` passed.

## Round 6

**Verdict:** needs-changes

### Findings
1. [F6.1] **CRITICAL: `knowledge list` and `context` do not actually list all knowledge files.** The design says `knowledge list` is an inventory of all knowledge files and explicitly says to reuse `collectKnowledgeDocuments()`, which recursively scans markdown. The implementation instead reads only immediate `.md` children of each branch in `src/commands/knowledge.js`, and `context` has the same one-level scan in `src/commands/context.js`. Repro: create `.specdev/knowledge/architecture/nested/deep.md`, then run `specdev knowledge list --json`; the file is omitted and `architecture` count remains 0. Agents would still need filesystem scanning to discover nested knowledge notes, which violates the command's purpose.
2. [F6.2] **MINOR: Session hook still omits the designed recent-history signal.** Tier 4 says the improved hook should inject the last completed assignment name so agents avoid re-proposing solved work. `hooks/session-start.sh` currently injects assignment/phase, phase commands, knowledge availability, and tool skills, but no recent history. Either add the signal via `context --json` or remove it from the design so the hook contract is accurate.
3. [F6.3] **MINOR: The design remains internally inconsistent about the JSON scope.** The Goals section now excludes `start` and `--version`, but Success Criteria still says "Every specdev command accepts `--json` and returns structured output." That ambiguity caused several earlier rounds of churn. Update the success criterion to match the narrowed contract.

### Addressed from changelog
- [F5.1] Fixed in the current workspace: `reviewloop <phase> --json` now emits clean JSON only.
- [F5.2] Fixed in the current workspace: `init --dry-run --json` now emits structured JSON.
