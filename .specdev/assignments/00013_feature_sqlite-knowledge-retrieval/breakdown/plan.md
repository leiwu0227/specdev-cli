# SQLite Knowledge Retrieval Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add a generated SQLite FTS cache so agents can search SpecDev markdown knowledge without rereading all assignments.

**Architecture:** Markdown remains the source of truth. A new `knowledge` command family builds and queries `.specdev/cache/knowledge.sqlite` using document-level FTS. Command output supports human-readable and JSON formats.

**Tech Stack:** Node.js ESM CLI, `fs-extra`, built-in `node:sqlite` when available, Node test scripts.

**Execution Mode:** inline

---

### Task 1: Add knowledge indexing and search core
**Mode:** full
**Skills:** test-driven-development
**Files:** Create `src/utils/knowledge.js`; Test `tests/test-knowledge.js`

**Step 1: Write the failing test**
Create `tests/test-knowledge.js` with a fixture project that runs `specdev init`, writes project notes, knowledge notes, assignment artifacts, and discussion artifacts, then asserts `specdev knowledge index --json` creates `.specdev/cache/knowledge.sqlite` and reports indexed documents.

**Step 2: Run test to verify it fails**
Run: `node --test tests/test-knowledge.js`
Expected: FAIL because the `knowledge` command does not exist.

**Step 3: Write minimal implementation**
Create `src/utils/knowledge.js` with:
- `buildKnowledgeIndex(specdevPath)`: full rebuild of `.specdev/cache/knowledge.sqlite`
- `searchKnowledgeIndex(specdevPath, query, options)`: FTS search returning ranked path/kind/title/snippet results
- document discovery for project notes, knowledge notes, assignment phase markdown, discussions, guides, and skills
- a clear unsupported-runtime error if `node:sqlite` is unavailable

**Step 4: Run test to verify progress**
Run: `node --test tests/test-knowledge.js`
Expected: still FAIL until command dispatch is wired.

### Task 2: Wire `specdev knowledge` CLI
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `src/commands/knowledge.js`; Modify `src/commands/dispatch.js`, `src/utils/commands.js`, `src/commands/help.js`; Test `tests/test-knowledge.js`

**Step 1: Extend the failing test**
Add assertions for:
- human `specdev knowledge search "bounded memory"` output
- `specdev knowledge search --json "bounded memory"` valid JSON
- missing database guidance
- unknown subcommand failure

**Step 2: Run test to verify it fails**
Run: `node --test tests/test-knowledge.js`
Expected: FAIL because dispatch/help are not wired.

**Step 3: Write minimal implementation**
Add `knowledgeCommand(positionalArgs, flags)` handling:
- `index`
- `search <query>`
- default usage/errors

Wire it into dispatch and command/help listings.

**Step 4: Run test to verify it passes**
Run: `node --test tests/test-knowledge.js`
Expected: PASS.

### Task 3: Add cache gitignore and package test coverage
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `templates/.specdev/.gitignore`, `.specdev/.gitignore`, `package.json`, `tests/test-init.js`; Test `tests/test-init.js`, `tests/test-knowledge.js`, `npm test`

**Step 1: Write the failing test**
Update `tests/test-init.js` to assert initialized projects include `.specdev/.gitignore` with `cache/`. Add `test:knowledge` to `package.json` and include it in `npm test`.

**Step 2: Run test to verify it fails**
Run: `node --test tests/test-init.js`
Expected: FAIL because `.specdev/.gitignore` is not created by templates yet.

**Step 3: Write minimal implementation**
Add `.specdev/.gitignore` and template `.specdev/.gitignore` with `cache/`.

**Step 4: Run verification**
Run: `node --test tests/test-init.js && node --test tests/test-knowledge.js && npm test`
Expected: PASS, unless the known full-suite reviewloop hang recurs; if it does, document focused test results and process-tree evidence.
