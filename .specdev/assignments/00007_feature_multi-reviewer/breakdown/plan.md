# Multi-Reviewer Support Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Enable `specdev reviewloop <phase> --reviewer=codex,claude` to run multiple reviewers in succession, each with independent round counters and separate feedback files.

**Architecture:** Refactor `reviewloop.js` to extract single-reviewer execution into a reusable function, then wrap it in a loop for comma-separated reviewers. Each reviewer gets its own feedback/changelog files (`{phase}-feedback-{reviewer}.md`). Update `check-review.js` to support `--reviewer` flag for multi-reviewer feedback.

**Tech Stack:** Node.js ESM, existing test harness

---

### Task 1: Extract single-reviewer execution into helper function
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Modify: `src/commands/reviewloop.js`
- Test: existing tests in `tests/test-reviewloop-command.js` must still pass

**Step 1: Write the failing test**

No new test — this is a refactor. We verify by running existing tests.

**Step 2: Run tests to verify they pass before refactoring**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS (all existing tests)

**Step 3: Refactor**

Extract the assignment-path reviewer execution logic (lines ~236-376) into a helper function:

```javascript
/**
 * Run a single reviewer for a given phase.
 * @param {object} options
 * @param {string} options.targetDir - project root
 * @param {string} options.assignmentPath - path to assignment directory
 * @param {string} options.name - assignment name
 * @param {string} options.phase - review phase
 * @param {string} options.reviewerName - reviewer config name
 * @param {string} options.feedbackFilename - feedback file basename (e.g., 'brainstorm-feedback.md')
 * @param {string} options.changelogFilename - changelog file basename
 * @returns {Promise<{approved: boolean, error: boolean, message: string}>}
 */
async function runSingleReviewer({
  targetDir, assignmentPath, name, phase, reviewerName,
  feedbackFilename, changelogFilename,
}) {
  const specdevPath = join(targetDir, '.specdev')
  const reviewerConfigPath = join(specdevPath, 'skills', 'core', 'reviewloop', 'reviewers', `${reviewerName}.json`)

  if (!(await fse.pathExists(reviewerConfigPath))) {
    console.error(`Reviewer config not found: ${reviewerName}`)
    console.log(`   Expected: ${reviewerConfigPath}`)
    return { approved: false, error: true, message: 'config not found' }
  }

  let config
  try {
    config = await fse.readJson(reviewerConfigPath)
  } catch {
    console.error(`Invalid reviewer config: ${reviewerConfigPath}`)
    return { approved: false, error: true, message: 'invalid config' }
  }

  if (!config.command) {
    console.error(`Reviewer config missing required field 'command'`)
    return { approved: false, error: true, message: 'missing command' }
  }

  const maxRounds = config.max_rounds || 3

  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  const feedbackPath = join(reviewDir, feedbackFilename)
  const changelogPath = join(reviewDir, changelogFilename)

  const feedbackContent = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''
  const changelogContent = (await fse.pathExists(changelogPath))
    ? await fse.readFile(changelogPath, 'utf-8')
    : ''

  if (hasUnaddressedFindings(feedbackContent, changelogContent)) {
    console.error('Previous review findings have not been addressed. Run specdev check-review.')
    return { approved: false, error: true, message: 'unaddressed findings' }
  }

  const { rounds } = parseReviewFeedback(feedbackContent)
  const round = rounds.length + 1

  if (round > maxRounds) {
    console.error('Max rounds reached. Escalating to user.')
    return { approved: false, error: true, message: 'max rounds' }
  }

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log(`   Reviewer: ${reviewerName}`)
  console.log(`   Round: ${round}/${maxRounds}`)
  blankLine()

  await writeCurrent(specdevPath, name)

  const focusText = await resolveRoundFocus(specdevPath, round)

  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
    SPECDEV_FOCUS: focusText,
  }

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', config.command], {
      cwd: targetDir,
      env: childEnv,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code))
  })

  if (exitCode !== 0) {
    console.error(`Reviewer exited with code ${exitCode}`)
    return { approved: false, error: true, message: 'reviewer failed' }
  }

  const updatedFeedback = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''

  const latestRound = getLatestRound(updatedFeedback)

  if (!latestRound || latestRound.round !== round) {
    console.error(
      `Expected round ${round} in ${feedbackFilename} but found ${latestRound ? `round ${latestRound.round}` : 'no rounds'}`,
    )
    return { approved: false, error: true, message: 'wrong round' }
  }

  blankLine()

  if (latestRound.verdict === 'approved') {
    return { approved: true, error: false, message: 'approved' }
  } else if (latestRound.verdict === 'needs-changes') {
    if (round >= maxRounds) {
      console.error('Max rounds reached. Escalating to user.')
    } else {
      printSection('Run specdev check-review to address findings')
    }
    return { approved: false, error: false, message: 'needs-changes' }
  } else {
    printSection(`Unexpected verdict: ${latestRound.verdict}`)
    console.log('   Run specdev check-review to inspect results')
    return { approved: false, error: false, message: 'unexpected verdict' }
  }
}
```

Then update the main `reviewloopCommand` function's assignment path to call this helper, preserving existing behavior:

```javascript
  // ── With --reviewer: run the review loop ──
  const reviewerName = flags.reviewer
  const feedbackFilename = `${phase}-feedback.md`
  const changelogFilename = `${phase}-changelog.md`

  const result = await runSingleReviewer({
    targetDir, assignmentPath, name, phase, reviewerName,
    feedbackFilename, changelogFilename,
  })

  if (result.error) {
    process.exitCode = 1
    return
  }

  if (result.approved) {
    const approveResult = await approvePhase(assignmentPath, phase)
    if (approveResult.approved) {
      printSection(`Review approved! Phase '${phase}' has been approved.`)
    } else {
      printSection('Review approved, but phase approval had errors:')
      for (const err of approveResult.errors) {
        console.log(`   - ${err}`)
      }
    }
  }
```

**Step 4: Run tests to verify refactor didn't break anything**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS (all existing tests)

**Step 5: Commit**
```
git add src/commands/reviewloop.js
git commit -m "refactor: extract runSingleReviewer helper in reviewloop.js"
```

---

### Task 2: Add multi-reviewer loop for assignment path
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop-command.js` (modify — add multi-reviewer tests)
- Modify: `src/commands/reviewloop.js`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop-command.js` before the `checkReviewerCLIs` section:

```javascript
// =====================================================================
// Multi-reviewer: comma-separated
// =====================================================================

console.log('\nreviewloop multi-reviewer (comma-separated):')
cleanup()
initProject()
fillBigPicture()
const aMulti1 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aMulti1, 'review'), { recursive: true })

const feedbackRelMulti1 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-a.md`
const feedbackRelMulti2 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-b.md`
setupReviewer('pass-a', {
  name: 'pass-a',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelMulti1}"`,
  max_rounds: 5,
})
setupReviewer('pass-b', {
  name: 'pass-b',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelMulti2}"`,
  max_rounds: 5,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-a,pass-b',
])
const multiOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'multi-reviewer exits 0 when all approve', result.stderr)
assert(multiOutput.includes('pass-a'), 'output mentions first reviewer')
assert(multiOutput.includes('pass-b'), 'output mentions second reviewer')
assert(
  multiOutput.includes("Phase 'brainstorm' has been approved"),
  'phase approved after all reviewers pass',
  multiOutput,
)

// Verify separate feedback files exist
const feedbackA = join(aMulti1, 'review', 'brainstorm-feedback-pass-a.md')
const feedbackB = join(aMulti1, 'review', 'brainstorm-feedback-pass-b.md')
assert(existsSync(feedbackA), 'reviewer A feedback file exists')
assert(existsSync(feedbackB), 'reviewer B feedback file exists')

// =====================================================================
// Multi-reviewer: second reviewer needs-changes stops chain
// =====================================================================

console.log('\nreviewloop multi-reviewer (chain stops on needs-changes):')
cleanup()
initProject()
fillBigPicture()
const aMulti2 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aMulti2, 'review'), { recursive: true })

const feedbackRelStop1 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-c.md`
const feedbackRelStop2 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-fail-c.md`
setupReviewer('pass-c', {
  name: 'pass-c',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelStop1}"`,
  max_rounds: 5,
})
setupReviewer('fail-c', {
  name: 'fail-c',
  command: `printf '## Round 1\\n\\n**Verdict:** needs-changes\\n\\n### Findings\\n1. [F1.1] Fix X\\n' >> "${feedbackRelStop2}"`,
  max_rounds: 5,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-c,fail-c',
])
const stopOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'chain-stop exits 0', result.stderr)
assert(stopOutput.includes('pass-c'), 'first reviewer ran')
assert(stopOutput.includes('fail-c'), 'second reviewer ran')
assert(
  !stopOutput.includes("Phase 'brainstorm' has been approved"),
  'phase NOT approved when second reviewer needs changes',
  stopOutput,
)

// =====================================================================
// Multi-reviewer: skip already-approved reviewer on re-run
// =====================================================================

console.log('\nreviewloop multi-reviewer (skip approved on re-run):')
// Re-run same chain — pass-c should be skipped (already approved)
// fail-c has needs-changes from round 1, so we need a changelog first
const changelogFailC = join(aMulti2, 'review', 'brainstorm-changelog-fail-c.md')
writeFileSync(changelogFailC, '## Round 1\n\n- Fixed X\n')

// Replace fail-c to now approve on round 2
const failCPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'fail-c.json')
const failCApprove = {
  name: 'fail-c',
  command: `printf '\\n## Round 2\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelStop2}"`,
  max_rounds: 5,
}
writeFileSync(failCPath, JSON.stringify(failCApprove))

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-c,fail-c',
])
const resumeOutput = `${result.stdout}\n${result.stderr}`
assert(resumeOutput.includes('already approved, skipping'), 'pass-c skipped as already approved')
assert(
  resumeOutput.includes("Phase 'brainstorm' has been approved"),
  'phase approved after resumed reviewer passes',
  resumeOutput,
)
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-command.js`
Expected: FAIL on "multi-reviewer exits 0 when all approve"

**Step 3: Write minimal implementation**

In the assignment path section of `reviewloopCommand`, replace the single-reviewer call with multi-reviewer logic:

```javascript
  // ── With --reviewer: run the review loop ──
  const reviewerNames = flags.reviewer.split(',').map(r => r.trim())
  const isMulti = reviewerNames.length > 1

  for (const reviewerName of reviewerNames) {
    const feedbackFilename = isMulti
      ? `${phase}-feedback-${reviewerName}.md`
      : `${phase}-feedback.md`
    const changelogFilename = isMulti
      ? `${phase}-changelog-${reviewerName}.md`
      : `${phase}-changelog.md`

    // Check if already approved (for resume capability)
    if (isMulti) {
      const reviewDir = join(assignmentPath, 'review')
      const fbPath = join(reviewDir, feedbackFilename)
      if (await fse.pathExists(fbPath)) {
        const fbContent = await fse.readFile(fbPath, 'utf-8')
        const latest = getLatestRound(fbContent)
        if (latest && latest.verdict === 'approved') {
          console.log(`Reviewer ${reviewerName} already approved, skipping`)
          continue
        }
      }
    }

    const result = await runSingleReviewer({
      targetDir, assignmentPath, name, phase, reviewerName,
      feedbackFilename, changelogFilename,
    })

    if (result.error) {
      process.exitCode = 1
      return
    }

    if (!result.approved) {
      // needs-changes or unexpected — stop chain
      return
    }
  }

  // All reviewers approved
  const approveResult = await approvePhase(assignmentPath, phase)
  if (approveResult.approved) {
    printSection(`Review approved! Phase '${phase}' has been approved.`)
  } else {
    printSection('Review approved, but phase approval had errors:')
    for (const err of approveResult.errors) {
      console.log(`   - ${err}`)
    }
  }
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS (all tests including new multi-reviewer tests)

**Step 5: Commit**
```
git add src/commands/reviewloop.js tests/test-reviewloop-command.js
git commit -m "feat: add multi-reviewer support with comma-separated --reviewer"
```

---

### Task 3: Update check-review.js for multi-reviewer feedback files
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop-command.js` (modify — add check-review multi-reviewer tests)
- Modify: `src/commands/check-review.js`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop-command.js` after the multi-reviewer tests from Task 2, before the `checkReviewerCLIs` section:

```javascript
// =====================================================================
// check-review with --reviewer flag (multi-reviewer)
// =====================================================================

console.log('\ncheck-review with --reviewer flag:')
cleanup()
initProject()
fillBigPicture()
const aCheck1 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
const checkReviewDir = join(aCheck1, 'review')
mkdirSync(checkReviewDir, { recursive: true })

// Write reviewer-specific feedback file
writeFileSync(
  join(checkReviewDir, 'brainstorm-feedback-test-rev.md'),
  '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix ABC\n',
)

result = runCmd([
  'check-review',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=test-rev',
])
const checkRevOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'check-review with --reviewer exits 0', result.stderr)
assert(checkRevOutput.includes('Fix ABC'), 'shows reviewer-specific findings')

// Test auto-detect: no --reviewer, no default feedback, scan for suffixed files
console.log('\ncheck-review auto-detect multi-reviewer:')
result = runCmd([
  'check-review',
  'brainstorm',
  `--target=${TEST_DIR}`,
])
const autoDetectOutput = `${result.stdout}\n${result.stderr}`
assert(autoDetectOutput.includes('Fix ABC'), 'auto-detect finds reviewer-specific feedback')
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop-command.js`
Expected: FAIL on "check-review with --reviewer exits 0"

**Step 3: Write minimal implementation**

In `check-review.js`:

First, update the `import` from `'fs'` to include `readdirSync`:

```javascript
import { writeSync, readdirSync } from 'fs'
```

Replace the feedback path resolution (around line 35-36) with:

```javascript
  const reviewDir = join(assignmentPath, 'review')

  // Determine feedback file path
  let feedbackPath
  let feedbackFilename

  if (flags.reviewer) {
    // Explicit reviewer flag — use reviewer-specific file
    feedbackFilename = `${phase}-feedback-${flags.reviewer}.md`
    feedbackPath = join(reviewDir, feedbackFilename)
  } else {
    // Default: try unsuffixed file first
    feedbackFilename = `${phase}-feedback.md`
    feedbackPath = join(reviewDir, feedbackFilename)

    // If default doesn't exist, scan for reviewer-specific files
    if (!(await fse.pathExists(feedbackPath)) && await fse.pathExists(reviewDir)) {
      const files = readdirSync(reviewDir)
        .filter(f => f.startsWith(`${phase}-feedback-`) && f.endsWith('.md'))
        .sort()

      for (const f of files) {
        const content = await fse.readFile(join(reviewDir, f), 'utf-8')
        const latest = getLatestRound(content)
        if (latest && latest.verdict === 'needs-changes') {
          feedbackFilename = f
          feedbackPath = join(reviewDir, f)
          break
        }
      }
    }
  }
```

Update the not-found error message (around line 43) to use `feedbackFilename` instead of hardcoded path:

```javascript
      detail: `No review/${feedbackFilename} found`,
```

Derive the changelog filename to match the feedback filename (add before the verdict handling):

```javascript
  // Derive changelog filename to match feedback filename
  const changelogFilename = feedbackFilename.replace('-feedback', '-changelog')
```

Update the non-JSON changelog console.log:

```javascript
    console.log(`   2. Append changes to: ${name}/review/${changelogFilename} under ## Round ${latest.round}`)
```

Update the JSON payload's `next_action` to use `changelogFilename`:

```javascript
          : `Address findings, then append to review/${changelogFilename} under ## Round ${latest.round}`,
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS

**Step 5: Commit**
```
git add src/commands/check-review.js tests/test-reviewloop-command.js
git commit -m "feat: update check-review for multi-reviewer feedback files"
```

---

### Task 4: Add multi-reviewer support to discussion path
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Modify: `src/commands/reviewloop.js` (discussion path)

**Step 1: Verify existing discussion reviewloop tests pass**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS

**Step 2: Refactor discussion path**

Apply the same multi-reviewer pattern to the discussion path in `reviewloopCommand`. The discussion path (starting around line 64 where `flags.reviewer` is checked) needs:

1. Split `flags.reviewer` on comma
2. For each reviewer, use reviewer-specific feedback/changelog filenames when multi
3. Skip already-approved reviewers
4. Print "Discussion review approved!" only when all reviewers approve

Extract the discussion single-reviewer logic into a helper (similar to `runSingleReviewer` but for discussions), or reuse `runSingleReviewer` by passing the discussion path as `assignmentPath` and adapting the env vars.

The discussion path currently hardcodes `brainstorm-feedback.md` — this existing bug is **out of scope**. For multi-reviewer mode, use `brainstorm-feedback-{reviewer}.md`. For single-reviewer mode, continue using the existing `brainstorm-feedback.md`.

The discussion path does NOT call `approvePhase()` — it just prints "Discussion review approved!" when all reviewers approve (consistent with current behavior).

**Step 3: Run tests to verify nothing broke**
Run: `node tests/test-reviewloop-command.js`
Expected: PASS

**Step 4: Commit**
```
git add src/commands/reviewloop.js
git commit -m "feat: add multi-reviewer support to discussion reviewloop path"
```

---

### Task 5: Full integration test and cleanup
**Mode:** full
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop-command.js` (verify all tests)
- Modify: `tests/test-reviewloop-focus.js` (add cleanup to test:cleanup script if needed)

**Step 1: Run full test suite**
Run: `npm test`
Expected: PASS

**Step 2: Verify backwards compatibility**

Verify single-reviewer mode is unchanged by examining test results for:
- All existing single-reviewer tests pass
- Feedback files use `{phase}-feedback.md` (no suffix) for single reviewer
- `check-review` works with default (unsuffixed) feedback files

**Step 3: Commit**
```
git add tests/test-reviewloop-command.js
git commit -m "test: verify multi-reviewer integration and backwards compatibility"
```
