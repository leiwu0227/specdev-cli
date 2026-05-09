# Agent-Friendly Workflow Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Make every specdev CLI command machine-consumable and give agents a single entry point to discover tools, knowledge, and state.

**Architecture:** New `context` command composes existing utilities. New `knowledge list` subcommand. Universal `--json` across all 13 commands that lack it. Session hook rewritten to use `context --json`.

**Tech Stack:** Node.js, fs-extra, existing CLI patterns

**Execution Mode:** subagent

---

### Task 1: Add `specdev context` command
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/commands/context.js`, Modify `src/commands/dispatch.js`, Modify `src/utils/commands.js`, Create `tests/test-context.js`

**Step 1: Write the failing test**
Create `tests/test-context.js` that:
- Runs `specdev init` in a temp directory
- Creates a knowledge file and an assignment folder
- Runs `specdev context --json --target=<dir>`
- Asserts exit 0, valid JSON, and fields: `command`, `version`, `cli_version`, `assignment`, `commands`, `knowledge`, `project_notes`, `skills`
- Asserts `commands` is a non-empty array with `name`, `usage`, `description` fields
- Asserts `knowledge.files` is an array
- Asserts `project_notes` is an array containing `project_notes/big_picture.md`
- Tests human output (no --json): exits 0, contains section headers

**Step 2: Run test to verify it fails**
Run: `node tests/test-context.js`
Expected: FAIL (command doesn't exist yet)

**Step 3: Write minimal implementation**
Create `src/commands/context.js`:
- Import `resolveTargetDir`, `resolveCurrentAssignment`, `detectAssignmentState` from existing utils
- Import `COMMANDS` from `src/utils/commands.js`
- Import `scanSkillsDir` from `src/utils/skills.js`
- Read `package.json` for `version` and `releaseDate`
- Scan `knowledge/` for files (read first H1 as title, classify branch from parent dir)
- Scan `project_notes/` for file listing
- Check `cache/knowledge.sqlite` existence for `index_exists`
- JSON output: full structured object
- Human output: compact section-based summary

Wire in `dispatch.js`:
- Import `contextCommand` from `./context.js`
- Add to `commandHandlers`: `context: ({ flags }) => contextCommand(flags)`

Wire in `commands.js`:
- Add entry: `{ name: 'context', usage: 'context', description: 'Dump project state, commands, knowledge, and skills for agents' }`

**Step 4: Run test to verify it passes**
Run: `node tests/test-context.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/context.js src/commands/dispatch.js src/utils/commands.js tests/test-context.js
git commit -m "feat: add specdev context command for agent bootstrapping"
```

---

### Task 2: Add `specdev knowledge list` subcommand
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/commands/knowledge.js`, Modify `src/utils/commands.js`, Modify `tests/test-knowledge.js`

**Step 1: Write the failing test**
Add to `tests/test-knowledge.js`:
- Run `specdev knowledge list --json --target=<dir>` after the existing index test fixture
- Assert exit 0, valid JSON
- Assert `command` is `"knowledge list"`
- Assert `files` is an array with objects containing `path`, `branch`, `title`
- Assert `branches` is an object with branch names as keys and counts as values
- Test human output: contains branch names and file counts

**Step 2: Run test to verify it fails**
Run: `node tests/test-knowledge.js`
Expected: FAIL (unknown subcommand)

**Step 3: Write minimal implementation**
In `src/commands/knowledge.js`:
- Add `knowledgeListCommand(flags)` function
- Scan knowledge directories: `architecture`, `codestyle`, `domain`, `workflow`, `workflow_feedback`
- For each `.md` file: read first H1 heading as title, record relative path and branch
- JSON output: `{ command: "knowledge list", version: 1, files: [...], branches: { ... } }`
- Human output: grouped by branch with file counts
- Wire `list` subcommand in `knowledgeCommand()` dispatch

Update `src/utils/commands.js`:
- Add entry: `{ name: 'knowledge list', usage: 'knowledge list', description: 'List all knowledge files with metadata' }`

**Step 4: Run test to verify it passes**
Run: `node tests/test-knowledge.js`
Expected: PASS (all tests including new ones)

**Step 5: Commit**
```
git add src/commands/knowledge.js src/utils/commands.js tests/test-knowledge.js
git commit -m "feat: add specdev knowledge list subcommand"
```

---

### Task 3: Add `--json` to simple commands (approve, focus, revise, help, skills-remove, migrate)
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/commands/approve.js`, `src/commands/focus.js`, `src/commands/revise.js`, `src/commands/help.js`, `src/commands/skills-remove.js`, `src/commands/migrate.js`, Modify `src/commands/dispatch.js` (for help flags), Create `tests/test-json-simple.js`

**Step 1: Write the failing test**
Create `tests/test-json-simple.js` that:
- Sets up a temp dir with `specdev init`, creates an assignment, approves brainstorm prerequisites
- For `help --json`: runs and asserts valid JSON with `commands` array containing `name`, `usage`, `description`
- For `focus --json`: focuses an assignment, asserts `assignment_id`, `assignment_name`, `path`
- For `approve --json`: asserts `phase`, `assignment`, `approved` fields (may need prerequisite setup)
- For `revise --json`: asserts `assignment`, `revision_recorded`, `phase` fields
- For `skills remove --json`: asserts `skill`, `removed` fields (needs a skill to remove)
- For `migrate --json`: asserts `plan_path` or guidance message in JSON

Each sub-test: assert exit 0, valid JSON, expected envelope fields.

**Step 2: Run test to verify it fails**
Run: `node tests/test-json-simple.js`
Expected: FAIL (no --json support)

**Step 3: Write minimal implementation**
For each command, add `if (flags.json)` branch that outputs structured JSON instead of console.log prose. Follow the existing envelope: `{ command, version: 1, status: "ok", ... }`.

- `approve.js`: After successful approval, emit `{ command: "approve", version: 1, status: "ok", phase, assignment, approved: true }`
- `focus.js`: After writing `.current`, emit `{ command: "focus", version: 1, status: "ok", assignment_id, assignment_name, path }`
- `revise.js`: After recording revision, emit `{ command: "revise", version: 1, status: "ok", assignment, revision_recorded: true, phase: "brainstorm" }`
- `help.js`: Accept `flags` parameter. Emit `{ command: "help", version: 1, commands: COMMANDS }`. Update dispatch.js to pass flags.
- `skills-remove.js`: After removal, emit `{ command: "skills remove", version: 1, status: "ok", skill, removed: true }`
- `migrate.js`: Emit `{ command: "migrate", version: 1, status: "ok", message: "..." }` with guidance

**Step 4: Run test to verify it passes**
Run: `node tests/test-json-simple.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/approve.js src/commands/focus.js src/commands/revise.js src/commands/help.js src/commands/skills-remove.js src/commands/migrate.js src/commands/dispatch.js tests/test-json-simple.js
git commit -m "feat: add --json to approve, focus, revise, help, skills-remove, migrate"
```

---

### Task 4: Add `--json` to medium commands (implement, migrate-legacy, review, skills-install, skills-sync, update)
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `src/commands/implement.js`, `src/commands/migrate-legacy-assignments.js`, `src/commands/review.js`, `src/commands/skills-install.js`, `src/commands/skills-sync.js`, `src/commands/update.js`, Create `tests/test-json-medium.js`

**Step 1: Write the failing test**
Create `tests/test-json-medium.js` that:
- Sets up temp dir with `specdev init`, creates assignment with plan
- `implement --json`: asserts `assignment`, `plan_path`, `tasks`, `execution_mode`
- `update --json`: asserts `cli_version`, `release_date`, `updated` array, `preserved` array
- `migrate-legacy --json --dry-run`: asserts `migrated`, `skipped` arrays
- `review --json`: asserts `phase`, `review_session_started` (or error if no assignment)
- `skills-install --json`: asserts `skill`, `installed`, `path` (needs a skill fixture)
- `skills-sync --json`: asserts `synced`, `created`, `removed` arrays

**Step 2: Run test to verify it fails**
Run: `node tests/test-json-medium.js`
Expected: FAIL

**Step 3: Write minimal implementation**
For each command, collect the data that's currently printed to console, then emit it as structured JSON when `flags.json` is set:

- `implement.js`: Collect plan path, parsed tasks, execution mode. Emit `{ command: "implement", version: 1, status: "ok", assignment, plan_path, tasks: [{name, mode}], execution_mode }`
- `update.js`: Already collects `updatedPaths`. Emit `{ command: "update", version: 1, status: "ok", cli_version, release_date, updated: [...], preserved: [...] }`
- `migrate-legacy-assignments.js`: Collect moved/skipped files. Emit `{ command: "migrate legacy-assignments", version: 1, status: "ok", migrated: [...], skipped: [...] }`
- `review.js`: Emit `{ command: "review", version: 1, status: "ok", phase, assignment, review_session_started: true }`
- `skills-install.js`: Collect installed skill info. Emit `{ command: "skills install", version: 1, status: "ok", skill, installed: true, path }`
- `skills-sync.js`: Collect sync results. Emit `{ command: "skills sync", version: 1, status: "ok", synced: [...], created: [...], removed: [...] }`

**Step 4: Run test to verify it passes**
Run: `node tests/test-json-medium.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/implement.js src/commands/migrate-legacy-assignments.js src/commands/review.js src/commands/skills-install.js src/commands/skills-sync.js src/commands/update.js tests/test-json-medium.js
git commit -m "feat: add --json to implement, migrate-legacy, review, skills-install, skills-sync, update"
```

---

### Task 5: Rewrite session hook to use `specdev context --json`
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `hooks/session-start.sh`, Create `tests/test-hook.js`

**Step 1: Write the failing test**
Create `tests/test-hook.js` that:
- Sets up a temp dir with `specdev init`, creates an assignment with knowledge files
- Runs the hook script with the temp dir
- Asserts output contains: assignment name, phase, phase-relevant commands, knowledge availability note
- Asserts output mentions `specdev knowledge search` when knowledge files exist
- Asserts output lists relevant commands for the current phase

**Step 2: Run test to verify it fails**
Run: `node tests/test-hook.js`
Expected: FAIL (current hook doesn't include commands or knowledge info)

**Step 3: Write minimal implementation**
Rewrite `hooks/session-start.sh`:
- Run `specdev context --json --target=<dir>` to get full state
- Parse JSON with lightweight tools (node one-liner or jq-like extraction)
- Inject into `additionalContext`:
  1. Assignment name + phase (existing)
  2. Phase-relevant commands (new): map phase to relevant commands
  3. Knowledge availability (new): "N knowledge files. Run `specdev knowledge search` for prior decisions."
  4. Tool skills (existing, but now from context JSON)

Keep backward compatibility: if `specdev context --json` fails, fall back to existing filesystem detection.

**Step 4: Run test to verify it passes**
Run: `node tests/test-hook.js`
Expected: PASS

**Step 5: Commit**
```
git add hooks/session-start.sh tests/test-hook.js
git commit -m "feat: rewrite session hook to use specdev context --json"
```
