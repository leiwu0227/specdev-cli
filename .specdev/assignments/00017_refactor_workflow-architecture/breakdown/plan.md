# Workflow Architecture Refactor Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Centralize SpecDev's structured workflow facts in a small contract and make existing CLI/docs surfaces consume or validate against it.

**Architecture:** Add `src/utils/workflow-contract.js` as the single data owner for phase lists, assignment types, artifact paths, gate fields, and brainstorm section requirements. Existing command modules keep their validation behavior in Node, but read lists and paths from the contract. A focused drift test verifies command help, generated command skills, templates, and guide text stay aligned.

**Tech Stack:** Node.js ESM, `fs-extra`, existing script-style tests under `tests/`, markdown templates under `templates/.specdev/`.

**Execution Mode:** inline

---

### Task 1: Add Workflow Contract Module
**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Create `src/utils/workflow-contract.js`; Test `tests/test-workflow-contract.js`; Modify `package.json`

**Step 1: Write the failing test**
Create `tests/test-workflow-contract.js`:

```js
import {
  ASSIGNMENT_TYPES,
  REQUIRED_BRAINSTORM_SECTIONS,
  commandPhases,
  artifactPaths,
  gateFields,
  assignmentTypeList,
} from '../src/utils/workflow-contract.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

console.log('\nworkflow contract:')
assert(ASSIGNMENT_TYPES.join(',') === 'feature,bugfix,refactor,familiarization', 'declares assignment types')
assert(assignmentTypeList(' | ') === 'feature | bugfix | refactor | familiarization', 'formats assignment type list')
assert(commandPhases.checkpoint.includes('discussion'), 'checkpoint supports discussion')
assert(commandPhases.approve.join(',') === 'brainstorm,implementation', 'approve phases are gated phases')
assert(REQUIRED_BRAINSTORM_SECTIONS.feature.includes('Success Criteria'), 'feature sections include success criteria')
assert(REQUIRED_BRAINSTORM_SECTIONS.refactor.includes('Non-Goals'), 'refactor sections include non-goals')
assert(artifactPaths.brainstorm.design === 'brainstorm/design.md', 'declares brainstorm design path')
assert(gateFields.implementation === 'implementation_approved', 'declares implementation gate field')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

Add `test:workflow-contract` to `package.json` and include it in `npm test`.

**Step 2: Run test to verify it fails**
Run: `npm run test:workflow-contract`
Expected: FAIL with module-not-found for `src/utils/workflow-contract.js`.

**Step 3: Write minimal implementation**
Create `src/utils/workflow-contract.js`:

```js
export const ASSIGNMENT_TYPES = ['feature', 'bugfix', 'refactor', 'familiarization']

export const phases = {
  canonical: ['brainstorm', 'breakdown', 'implementation', 'capture'],
  aliases: {
    implementation: ['implement'],
    capture: ['summary'],
  },
}

export const commandPhases = {
  checkpoint: ['brainstorm', 'implementation', 'discussion'],
  approve: ['brainstorm', 'implementation'],
  review: ['brainstorm', 'implementation', 'discussion'],
  checkReview: ['brainstorm', 'implementation'],
  reviewloop: ['brainstorm', 'implementation', 'discussion'],
}

export const REQUIRED_BRAINSTORM_SECTIONS = {
  feature: ['Overview', 'Goals', 'Non-Goals', 'Design', 'Success Criteria'],
  bugfix: ['Overview', 'Root Cause', 'Fix Design', 'Success Criteria'],
  refactor: ['Overview', 'Non-Goals', 'Design', 'Success Criteria'],
  familiarization: ['Overview'],
}

export const artifactPaths = {
  brainstorm: {
    proposal: 'brainstorm/proposal.md',
    design: 'brainstorm/design.md',
  },
  breakdown: {
    plan: 'breakdown/plan.md',
  },
  implementation: {
    progress: 'implementation/progress.json',
  },
  capture: {
    projectNotesDiff: 'capture/project-notes-diff.md',
    workflowDiff: 'capture/workflow-diff.md',
  },
}

export const gateFields = {
  brainstorm: 'brainstorm_approved',
  implementation: 'implementation_approved',
}

export function assignmentTypeList(separator = ', ') {
  return ASSIGNMENT_TYPES.join(separator)
}

export function phaseList(command, separator = ' | ') {
  return (commandPhases[command] || []).join(separator)
}
```

**Step 4: Run test to verify it passes**
Run: `npm run test:workflow-contract`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/utils/workflow-contract.js tests/test-workflow-contract.js package.json package-lock.json
git commit -m "Add workflow contract module"
```

### Task 2: Wire Contract Into Assignment And Phase Commands
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/assignment.js`, `src/commands/checkpoint.js`, `src/commands/approve.js`, `src/commands/review.js`, `src/commands/reviewloop.js`, `src/utils/approve-phase.js`, `src/utils/state.js`, `src/commands/continue.js`; Modify tests `tests/test-assignment.js`, `tests/test-checkpoints.js`, `tests/test-approve-phase.js`, `tests/test-workflow.js`

**Step 1: Write the failing test**
Add to `tests/test-assignment.js` near typed assignment tests:

```js
console.log('\nassignment with unsupported --type rejects before folder creation:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content.\n\n## Tech Stack\nNode.js\n')
const invalidTypeResult = await runAssignmentDirect(['Bad type'], { target: TEST_DIR, type: 'spike', slug: 'bad', json: true })
assert(invalidTypeResult.status === 1, 'exits non-zero for unsupported type')
assert(invalidTypeResult.stderr.includes('Unknown assignment type'), 'reports unknown assignment type')
assert(!existsSync(join(TEST_DIR, '.specdev/assignments/00001_spike_bad')), 'does not create unsupported type folder')
```

Update checkpoint tests to import `REQUIRED_BRAINSTORM_SECTIONS` and derive expected section fixtures from the contract instead of duplicating section lists where practical.

**Step 2: Run tests to verify failure**
Run: `npm run test:assignment && npm run test:checkpoints`
Expected: FAIL on unsupported type test because `assignmentCommand` currently creates `00001_spike_bad`.

**Step 3: Write minimal implementation**
- In `assignment.js`, import `ASSIGNMENT_TYPES` and `assignmentTypeList`.
- Before creating a typed folder, reject `flags.type` not in `ASSIGNMENT_TYPES`.
- Replace fallback help text `feature | bugfix | refactor | familiarization` with `assignmentTypeList(' | ')`.
- In `checkpoint.js`, replace local `VALID_PHASES` with `commandPhases.checkpoint` and `REQUIRED_SECTIONS` with `REQUIRED_BRAINSTORM_SECTIONS`.
- In `approve.js`, `review.js`, and `reviewloop.js`, replace local phase lists with `commandPhases.<command>`.
- In `approve-phase.js`, `state.js`, and `continue.js`, replace artifact and gate string literals where direct substitution is clear. Do not contort the state machine; leave readable state names as literals.

**Step 4: Run tests to verify pass**
Run: `npm run test:assignment && npm run test:checkpoints && npm run test:approve-phase && npm run test:workflow && npm run test:reviewloop-command`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/commands/assignment.js src/commands/checkpoint.js src/commands/approve.js src/commands/review.js src/commands/reviewloop.js src/utils/approve-phase.js src/utils/state.js src/commands/continue.js tests/test-assignment.js tests/test-checkpoints.js tests/test-approve-phase.js tests/test-workflow.js package.json package-lock.json
git commit -m "Use workflow contract in phase commands"
```

### Task 3: Make Generated Command Skills Contract-Aware
**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify `src/commands/init.js`; Test `tests/test-init.js`

**Step 1: Write the failing test**
In `tests/test-init.js`, after reading command skills, assert generated command skills contain current contract values. Import `ASSIGNMENT_TYPES` and `commandPhases` from the contract:

```js
const expectedTypes = ASSIGNMENT_TYPES.join(' | ')
assert(assignmentSkill.includes(expectedTypes), 'assignment skill uses contract assignment type list')

const reviewSkill = readFileSync(join(codexSkillsDir, 'specdev-review', 'SKILL.md'), 'utf-8')
assert(reviewSkill.includes(commandPhases.review.filter(p => p !== 'discussion').join(' or ')), 'review skill uses contract review phases')

const reviewloopSkill = readFileSync(join(codexSkillsDir, 'specdev-reviewloop', 'SKILL.md'), 'utf-8')
assert(reviewloopSkill.includes(commandPhases.reviewloop.filter(p => p !== 'discussion').join('` or `')), 'reviewloop skill uses contract reviewloop phases')
```

**Step 2: Run test to verify failure**
Run: `npm run test:init`
Expected: FAIL until generated text is built from imported contract values.

**Step 3: Write minimal implementation**
In `src/commands/init.js`:
- Import `ASSIGNMENT_TYPES` and `commandPhases`.
- Define local helpers near `SKILL_FILES`:

```js
const assignmentTypesText = ASSIGNMENT_TYPES.join(' | ')
const assignmentReviewPhasesText = commandPhases.review.filter(p => p !== 'discussion').join(' or ')
```

- Use those constants inside `specdev-assignment`, `specdev-review`, `specdev-check-review`, and `specdev-reviewloop` template strings.
- Keep discussion-specific instructions explicit where they are not just a phase list.

**Step 4: Run test to verify pass**
Run: `npm run test:init && npm run test:update`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add src/commands/init.js tests/test-init.js package.json package-lock.json
git commit -m "Render command skills from workflow contract"
```

### Task 4: Add Contract Drift Test For Templates And Guides
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Create `tests/test-workflow-contract-drift.js`; Modify `templates/.specdev/_templates/brainstorm-design.md`, `templates/.specdev/_main.md`, `templates/.specdev/_guides/workflow.md`, `templates/.specdev/skills/core/knowledge-capture/SKILL.md`, `package.json`

**Step 1: Write the failing test**
Create `tests/test-workflow-contract-drift.js`:

```js
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASSIGNMENT_TYPES,
  REQUIRED_BRAINSTORM_SECTIONS,
  artifactPaths,
  commandPhases,
} from '../src/utils/workflow-contract.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf-8')

console.log('\nworkflow contract drift:')
const workflow = read('templates/.specdev/_guides/workflow.md')
assert(workflow.includes(ASSIGNMENT_TYPES.join(' | ')), 'workflow guide uses contract assignment type list')

const main = read('templates/.specdev/_main.md')
assert(main.includes('specdev knowledge search'), '_main.md tells agents to search knowledge')
assert(main.includes('knowledge/workflow'), '_main.md mentions workflow FAQ knowledge')

const brainstormTemplate = read('templates/.specdev/_templates/brainstorm-design.md')
for (const [type, sections] of Object.entries(REQUIRED_BRAINSTORM_SECTIONS)) {
  assert(brainstormTemplate.includes(type), `brainstorm template documents ${type} sections`)
  for (const section of sections) {
    assert(brainstormTemplate.includes(section), `brainstorm template includes ${section}`)
  }
}

const knowledgeCapture = read('templates/.specdev/skills/core/knowledge-capture/SKILL.md')
assert(knowledgeCapture.includes('knowledge/workflow/'), 'knowledge capture explains workflow FAQ notes')
assert(knowledgeCapture.includes('knowledge/workflow_feedback/'), 'knowledge capture preserves workflow feedback distinction')

const initSource = read('src/commands/init.js')
for (const phase of commandPhases.review.filter(p => p !== 'discussion')) {
  assert(initSource.includes(phase), `generated command skills mention review phase ${phase}`)
}

assert(workflow.includes(artifactPaths.brainstorm.proposal), 'workflow guide mentions brainstorm proposal path')
assert(workflow.includes(artifactPaths.brainstorm.design), 'workflow guide mentions brainstorm design path')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

Add `test:workflow-contract-drift` to `package.json` and include it in `npm test`.

**Step 2: Run test to verify failure**
Run: `npm run test:workflow-contract-drift`
Expected: FAIL because `_main.md` does not yet mention workflow FAQ search and the brainstorm template may not document per-type sections.

**Step 3: Write minimal implementation**
- Update `_main.md` with a short rule: when workflow instructions conflict, commands fail unexpectedly, or the agent is unsure how to use SpecDev, run `specdev knowledge search "<issue>"` and inspect `knowledge/workflow/` before guessing.
- Update `knowledge-capture/SKILL.md` to add workflow FAQ creation/update guidance using the design's FAQ shape.
- Update `brainstorm-design.md` to document required sections by assignment type, generated from the contract values manually in the template.
- Update `_guides/workflow.md` assignment type list to match the contract if needed.

**Step 4: Run test to verify pass**
Run: `npm run test:workflow-contract-drift && npm run test:init && npm run test:knowledge`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add tests/test-workflow-contract-drift.js templates/.specdev/_main.md templates/.specdev/_guides/workflow.md templates/.specdev/_templates/brainstorm-design.md templates/.specdev/skills/core/knowledge-capture/SKILL.md package.json package-lock.json
git commit -m "Add workflow contract drift checks"
```

### Task 5: Final Integration And Release Date
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify `package.json`; Review all changed files

**Step 1: Write the failing test**
No new test file. The failing condition is stale release metadata and integration regressions.

**Step 2: Run test to verify current state**
Run: `npm test`
Expected: PASS after prior tasks; if any test fails, fix the regression before continuing.

**Step 3: Write minimal implementation**
- Update `package.json` `releaseDate` to the current date.
- Run `npm test` again.
- Run `git diff --check`.
- Review diff for accidental edits under installed `.specdev/` except assignment artifacts.

**Step 4: Run test to verify pass**
Run:
```bash
npm test
git diff --check
specdev status
```
Expected: tests pass, diff check clean, status shows implementation ready or in progress according to task completion.

**Step 5: Commit**
Run:
```bash
git add package.json package-lock.json src tests templates
git commit -m "Centralize workflow contract facts"
```
