# Guided Layout Migration Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Make `specdev migrate` a non-destructive guided layout migration entrypoint while preserving the old deterministic assignment migration behind an explicit legacy subcommand.

**Architecture:** Bare `migrate` prints an agent-guided workflow from `src/commands/migrate.js`. The old file-moving logic moves to `src/commands/migrate-legacy-assignments.js` and is routed through `specdev migrate legacy-assignments`, following the existing `distill done` dispatch precedent. The single `_guides/migration_guide.md` becomes the combined guide, and `specdev-layout-migration` is installed as an agent command skill through `SKILL_FILES`.

**Tech Stack:** Node.js ESM CLI, `fs-extra`, plain Node test files using `spawnSync`, template files copied by `specdev init` and refreshed by `specdev update`.

**Execution Mode:** inline

---

### Task 1: Make Migrate Default Guided And Move Legacy Behavior Behind A Subcommand

**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `tests/test-workflow.js`; modify `src/commands/dispatch.js`; modify `src/commands/migrate.js`; create `src/commands/migrate-legacy-assignments.js`

**Step 1: Write the failing tests**

Update the migration section in `tests/test-workflow.js` so it verifies:

```js
console.log('\nmigrate guided default:')
const migA1 = setupLegacyAssignment('00001_feature_legacy')
const guided = runCmd(['migrate', `--target=${TEST_DIR}`])
assert(guided.status === 0, 'guided migrate exits 0', guided.stderr)
assert(guided.stdout.includes('Guided SpecDev migration'), 'guided migrate prints guided heading')
assert(guided.stdout.includes('.specdev/_guides/migration_guide.md'), 'guided migrate points to migration guide')
assert(guided.stdout.includes('specdev-layout-migration'), 'guided migrate points to agent skill')
assert(existsSync(join(migA1, 'proposal.md')), 'guided migrate keeps legacy proposal.md')
assert(!existsSync(join(migA1, 'brainstorm', 'proposal.md')), 'guided migrate does not move files')

console.log('\nmigrate legacy dry-run:')
const dryRun = runCmd(['migrate', 'legacy-assignments', `--target=${TEST_DIR}`, '--dry-run'])
assert(dryRun.status === 0, 'legacy dry-run exits 0', dryRun.stderr)
assert(dryRun.stdout.includes('Migrating'), 'legacy dry-run uses assignment migrator')
assert(existsSync(join(migA1, 'proposal.md')), 'legacy dry-run keeps legacy proposal.md')
assert(!existsSync(join(migA1, 'brainstorm', 'proposal.md')), 'legacy dry-run does not move files')

console.log('\nmigrate legacy apply:')
const apply = runCmd(['migrate', 'legacy-assignments', `--target=${TEST_DIR}`])
assert(apply.status === 0, 'legacy migrate exits 0', apply.stderr)
assert(!existsSync(join(migA1, 'proposal.md')), 'moves proposal.md from legacy root')
assert(existsSync(join(migA1, 'brainstorm', 'proposal.md')), 'creates brainstorm/proposal.md')
assert(!existsSync(join(migA1, 'plan.md')), 'moves plan.md from legacy root')
assert(existsSync(join(migA1, 'breakdown', 'plan.md')), 'creates breakdown/plan.md')
assert(!existsSync(join(migA1, 'implementation.md')), 'moves implementation.md from legacy root')
assert(existsSync(join(migA1, 'implementation', 'implementation.md')), 'creates implementation/implementation.md')
assert(existsSync(join(migA1, 'implementation', 'progress.json')), 'creates implementation/progress.json')
assert(existsSync(join(migA1, 'context')), 'ensures context/ exists')
```

Also update the assignment filter and missing assignment checks to call `['migrate', 'legacy-assignments', ...]`.

**Step 2: Run test to verify it fails**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js"`

Expected: FAIL because bare `migrate` still moves files and `migrate legacy-assignments` is not routed.

**Step 3: Write minimal implementation**

In `src/commands/dispatch.js`, import the legacy command and add inline migrate routing:

```js
import { migrateLegacyAssignmentsCommand } from './migrate-legacy-assignments.js'
```

```js
  if (command === 'migrate') {
    const subcommand = positionalArgs[0]
    if (subcommand === 'legacy-assignments') {
      await migrateLegacyAssignmentsCommand(flags)
    } else if (subcommand) {
      console.error(`Unknown migrate subcommand: ${subcommand}`)
      console.log('Run "specdev migrate" for guided migration instructions')
      process.exitCode = 1
    } else {
      await migrateCommand(flags)
    }
    return
  }
```

Remove `migrate` from `commandHandlers`.

In `src/commands/migrate.js`, replace automatic file movement with a guided output that validates `.specdev/`:

```js
import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'

export async function migrateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  blankLine()
  printSection('Guided SpecDev migration')
  printBullets([
    'Read .specdev/_guides/migration_guide.md',
    'Use the specdev-layout-migration agent skill when available',
    'Inventory the current .specdev/ tree before editing',
    'Write .specdev/migration/layout-plan.md with proposed moves and open questions',
    'Ask the user before moving, renaming, or deleting ambiguous artifacts',
    'Apply only approved moves, then verify with specdev status --json',
  ])
  blankLine()
  printSection('Legacy assignment-file migration')
  printBullets([
    'For the old deterministic V3-to-V4 assignment file mover, run:',
    'specdev migrate legacy-assignments --dry-run',
    'specdev migrate legacy-assignments',
  ])
}
```

Move the current implementation from `src/commands/migrate.js` into `src/commands/migrate-legacy-assignments.js`, renaming the export to `migrateLegacyAssignmentsCommand`.

**Step 4: Run test to verify it passes**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js"`

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add src/commands/dispatch.js src/commands/migrate.js src/commands/migrate-legacy-assignments.js tests/test-workflow.js .specdev/assignments/00012_feature_guided-layout-migration
git commit -m "feat: make migrate a guided entrypoint"
```

### Task 2: Add Combined Migration Guide And Layout Migration Command Skill

**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `.specdev/_guides/migration_guide.md`; modify `templates/.specdev/_guides/migration_guide.md`; modify `src/commands/init.js`; modify `tests/test-init.js`; modify `tests/test-update.js`

**Step 1: Write the failing tests**

In `tests/test-init.js`, add assertions in the command skill loop:

```js
  assert(existsSync(join(skillsDir, 'specdev-layout-migration', 'SKILL.md')), `${agentName} specdev-layout-migration/SKILL.md installed`)
```

After the existing skill content checks, add:

```js
const layoutMigrationSkill = readFileSync(join(codexSkillsDir, 'specdev-layout-migration', 'SKILL.md'), 'utf-8')
assert(layoutMigrationSkill.includes('.specdev/_guides/migration_guide.md'), 'layout migration skill references migration guide')
assert(layoutMigrationSkill.includes('layout-plan.md'), 'layout migration skill requires a layout plan')
```

In `tests/test-update.js`, add an assertion after command skill refresh:

```js
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'specdev-layout-migration', 'SKILL.md')), 'layout migration command skill installed by update')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'specdev-layout-migration', 'SKILL.md')), 'codex layout migration command skill installed by update')
```

**Step 2: Run tests to verify they fail**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-init.js && node tests/test-update.js"`

Expected: FAIL because `specdev-layout-migration` is not installed.

**Step 3: Write minimal implementation**

Add `specdev-layout-migration` to `SKILL_FILES` in `src/commands/init.js` with content that instructs agents to read `.specdev/_guides/migration_guide.md`, inventory `.specdev/`, write `.specdev/migration/layout-plan.md`, ask before edits, and then apply only approved changes.

Replace both `.specdev/_guides/migration_guide.md` and `templates/.specdev/_guides/migration_guide.md` with a combined guide containing:

- modern target structure
- inspect-only first pass
- classification table
- layout plan template
- user confirmation rule
- verification steps
- scoped `specdev migrate legacy-assignments` section for the old deterministic assignment-file migration

**Step 4: Run tests to verify they pass**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-init.js && node tests/test-update.js"`

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add src/commands/init.js tests/test-init.js tests/test-update.js .specdev/_guides/migration_guide.md templates/.specdev/_guides/migration_guide.md .specdev/assignments/00012_feature_guided-layout-migration
git commit -m "feat: add guided migration skill and guide"
```

### Task 3: Update Public Command Documentation

**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `README.md`; modify `src/utils/commands.js`; modify `src/commands/help.js` if option text needs clarification; modify `tests/test-workflow.js` if command output assertions need adjustment

**Step 1: Write the failing test**

Extend the guided migrate test in `tests/test-workflow.js` to assert the output includes the exact legacy command:

```js
assert(guided.stdout.includes('specdev migrate legacy-assignments --dry-run'), 'guided migrate points to legacy dry run')
```

**Step 2: Run test to verify it fails if documentation/output is incomplete**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js"`

Expected: FAIL if the command output does not include the explicit legacy dry-run command.

**Step 3: Write minimal implementation**

Update `src/utils/commands.js` so `migrate` is described as guided, not automatic:

```js
{ name: 'migrate', usage: 'migrate', description: 'Show guided .specdev layout migration workflow' },
{ name: 'migrate legacy-assignments', usage: 'migrate legacy-assignments', description: 'Move legacy root assignment files into phase folders' },
```

Update `README.md` command examples:

```md
specdev migrate                         # Guided .specdev layout migration workflow
specdev migrate legacy-assignments --dry-run
```

Update any `specdev update` completion text that says "run: specdev migrate" so it frames the command as guided rather than automatic.

**Step 4: Run test to verify it passes**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js"`

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add README.md src/utils/commands.js src/commands/help.js src/commands/update.js tests/test-workflow.js .specdev/assignments/00012_feature_guided-layout-migration
git commit -m "docs: document guided migrate workflow"
```

### Task 4: Final Verification And Implementation Checkpoint

**Mode:** full
**Skills:** test-driven-development, verification-before-completion
**Files:** Modify `.specdev/assignments/00012_feature_guided-layout-migration/implementation/progress.json`; run full test suite; run implementation checkpoint

**Step 1: Run full verification**

Run: `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "npm test"`

Expected: PASS.

**Step 2: Verify command behavior manually**

Run:

```bash
node bin/specdev.js migrate --target=.
node bin/specdev.js migrate legacy-assignments --target=. --dry-run
node bin/specdev.js help
```

Expected: bare migrate prints guided instructions and does not move files; legacy dry-run prints deterministic migration preview; help lists both migration commands or clearly describes guided migration.

**Step 3: Update implementation progress**

Mark all tasks completed in `.specdev/assignments/00012_feature_guided-layout-migration/implementation/progress.json` after the commands pass.

**Step 4: Run implementation checkpoint**

Run: `specdev checkpoint implementation`

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add .specdev/assignments/00012_feature_guided-layout-migration
git commit -m "chore: checkpoint guided migration implementation"
```
