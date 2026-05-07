# Reviewer Preflight Checks Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add reviewer preflight checks so `reviewloop` can validate reviewer readiness before launching external CLIs.

**Architecture:** Add a reusable preflight utility under `src/utils/` and call it from `reviewloopCommand` for explicit `--preflight` mode and before normal reviewer execution. Keep reviewer execution semantics unchanged after preflight passes.

**Tech Stack:** Node.js ESM CLI, `fs-extra`, `child_process.spawnSync`, existing reviewloop tests.

**Execution Mode:** inline

---

### Task 1: Add reviewer preflight utility
**Mode:** standard
**Skills:** test-driven-development
**Files:** Create `src/utils/reviewer-preflight.js`; Test `tests/test-reviewloop-command.js`

**Step 1: Write the failing tests**
Add preflight tests to `tests/test-reviewloop-command.js` after reviewer config validation:

```js
console.log('\nreviewloop preflight (valid reviewer):')
cleanup()
initProject()
fillBigPicture()
const pfAssignment = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('preflight-ok', {
  name: 'preflight-ok',
  command: 'node --version',
  max_rounds: 3,
  timeout_seconds: 30,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-ok',
  '--preflight',
  '--json',
])
assert(result.status === 0, 'preflight exits 0 for valid reviewer', result.stderr)
let preflight = JSON.parse(result.stdout)
assert(preflight.status === 'pass', 'preflight JSON status is pass')
assert(preflight.reviewers[0].name === 'preflight-ok', 'preflight names reviewer')
assert(preflight.reviewers[0].command.status === 'pass', 'preflight command passes')
assert(preflight.reviewers[0].binary.found === true, 'preflight finds node binary')
assert(!existsSync(join(pfAssignment, 'review', 'brainstorm-feedback.md')), 'preflight does not run reviewer command')

console.log('\nreviewloop preflight (missing command):')
setupReviewer('preflight-missing-command', { name: 'preflight-missing-command' })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-missing-command',
  '--preflight',
  '--json',
])
assert(result.status === 1, 'preflight exits 1 for missing command')
preflight = JSON.parse(result.stdout)
assert(preflight.status === 'fail', 'preflight JSON status is fail')
assert(preflight.reviewers[0].issues.some((i) => i.code === 'missing_command'), 'preflight reports missing_command')
```

**Step 2: Run tests to verify they fail**
Run: `node ./tests/test-reviewloop-command.js`
Expected: FAIL because `--preflight` is not implemented and/or reviewer command is spawned.

**Step 3: Write minimal implementation**
Create `src/utils/reviewer-preflight.js`:

```js
import { spawnSync } from 'child_process'
import { join } from 'path'
import fse from 'fs-extra'

const DEFAULT_REVIEWER_TIMEOUT_SECONDS = 900

export function reviewerTimeoutSeconds(config) {
  const value = Number(config.timeout_seconds)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_REVIEWER_TIMEOUT_SECONDS
  return value
}

export async function preflightReviewers({ specdevPath, assignmentPath, reviewerNames }) {
  const reviewers = []
  for (const reviewerName of reviewerNames) {
    reviewers.push(await preflightReviewer({ specdevPath, assignmentPath, reviewerName }))
  }
  return {
    version: 1,
    status: reviewers.some((r) => r.blocking) ? 'fail' : 'pass',
    reviewers,
  }
}

async function preflightReviewer({ specdevPath, assignmentPath, reviewerName }) {
  const issues = []
  const reviewerConfigPath = join(specdevPath, 'skills', 'core', 'reviewloop', 'reviewers', `${reviewerName}.json`)
  let config = null
  let configStatus = 'pass'
  if (!(await fse.pathExists(reviewerConfigPath))) {
    configStatus = 'fail'
    issues.push({ code: 'missing_config', severity: 'error', detail: `Reviewer config not found: ${reviewerName}` })
  } else {
    try {
      config = await fse.readJson(reviewerConfigPath)
    } catch {
      configStatus = 'fail'
      issues.push({ code: 'invalid_config', severity: 'error', detail: `Invalid reviewer config: ${reviewerConfigPath}` })
    }
  }

  const commandText = config?.command || ''
  const binaryName = commandText.trim().split(/\s+/)[0] || ''
  const commandStatus = commandText ? 'pass' : 'fail'
  if (!commandText) {
    issues.push({ code: 'missing_command', severity: 'error', detail: "Reviewer config missing required field 'command'" })
  }

  const which = binaryName ? spawnSync('which', [binaryName], { encoding: 'utf-8' }) : null
  const binary = { name: binaryName, found: Boolean(which && which.status === 0) }
  if (binaryName && !binary.found) {
    issues.push({ code: 'missing_binary', severity: 'warning', detail: `${binaryName} not found on PATH` })
  }

  const reviewDir = join(assignmentPath, 'review')
  let reviewDirStatus = 'pass'
  try {
    await fse.ensureDir(reviewDir)
    await fse.access(reviewDir, fse.constants.W_OK)
  } catch {
    reviewDirStatus = 'fail'
    issues.push({ code: 'review_dir_unwritable', severity: 'error', detail: `Review directory is not writable: ${reviewDir}` })
  }

  const blocking = issues.some((i) => i.severity === 'error')
  return {
    name: reviewerName,
    config: { status: configStatus, path: reviewerConfigPath },
    command: { status: commandStatus, value: commandText },
    binary,
    timeout_seconds: reviewerTimeoutSeconds(config || {}),
    review_dir: { status: reviewDirStatus, path: reviewDir },
    blocking,
    issues,
  }
}
```

**Step 4: Run tests to verify utility behavior after integration task**
Run after Task 2: `node ./tests/test-reviewloop-command.js`
Expected: PASS.

### Task 2: Integrate preflight into reviewloop
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `src/commands/reviewloop.js`, `src/utils/reviewer-preflight.js`, `src/utils/reviewers.js`, `tests/test-reviewloop-command.js`

**Step 1: Write the failing integration tests**
Add test that normal execution stops on blocking preflight before spawning:

```js
console.log('\nreviewloop preflight blocks normal execution:')
cleanup()
initProject()
fillBigPicture()
const pfBlockAssignment = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('preflight-block', { name: 'preflight-block' })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-block',
])
assert(result.status === 1, 'normal reviewloop exits 1 when preflight blocks')
const pfBlockOutput = `${result.stdout}\n${result.stderr}`
assert(pfBlockOutput.includes('Reviewer preflight failed'), 'normal reviewloop prints preflight failure')
assert(!existsSync(join(pfBlockAssignment, 'review', 'brainstorm-feedback.md')), 'blocked preflight does not run reviewer')
```

**Step 2: Run tests to verify they fail**
Run: `node ./tests/test-reviewloop-command.js`
Expected: FAIL until `reviewloopCommand` handles `--preflight` and automatic preflight.

**Step 3: Write minimal implementation**
Modify `src/commands/reviewloop.js`:

- Import `preflightReviewers`.
- Remove local duplicate `reviewerTimeoutSeconds` or import it from `reviewer-preflight.js`.
- Add `emitPreflightResult(result, asJson)` helper.
- In assignment and discussion `--reviewer` paths:
  - Compute `specdevPath`.
  - Run preflight.
  - If `flags.preflight`, emit and return; set exit code 1 on fail.
  - If normal execution and preflight fails, print `Reviewer preflight failed` and return with exit code 1.
  - Continue existing `runReviewerChain` only when preflight passes.

Keep missing binary as warning-only so test mock commands and shell builtins are not broken.

**Step 4: Run targeted tests**
Run: `node ./tests/test-reviewloop-command.js`
Expected: PASS.

**Step 5: Run full suite**
Run: `npm test`
Expected: PASS.

**Step 6: Commit**
Run:

```bash
git add src/utils/reviewer-preflight.js src/commands/reviewloop.js tests/test-reviewloop-command.js .specdev/assignments/00009_feature_reviewer-preflight-checks
git commit -m "feat: add reviewer preflight checks"
```
