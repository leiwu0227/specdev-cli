# Autocontinue After Reviewloop Approval Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Make `specdev reviewloop <phase> --reviewer=<name> --autocontinue` carry an approved assignment forward without asking the user for redundant follow-up commands.

**Architecture:** Keep `reviewloop` as the owner of review execution and phase approval, then emit explicit machine-readable and human-readable continuation instructions after approval. Update source-of-truth templates and generated wrapper text so agents honor the continuation contract for brainstorm and implementation phases.

**Tech Stack:** Node.js ES modules CLI, fs-extra, shell-based command tests, SpecDev templates under `templates/.specdev/`.

**Execution Mode:** inline

---

### Task 1: Make Reviewloop Autocontinue Output Testable
**Mode:** standard
**Skills:** [test-driven-development]
**Files:** Modify/Test `tests/test-reviewloop-command.js`, `src/commands/reviewloop.js`

**Step 1: Write the failing test**
Append this block in `tests/test-reviewloop-command.js` after the existing "reviewloop (pass verdict with mock reviewer)" case:

```js
console.log('\nreviewloop (brainstorm autocontinue approved):')
cleanup()
initProject()
fillBigPicture()
const aAutocontinueBrainstorm = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aAutocontinueBrainstorm, 'review'), { recursive: true })
const feedbackRelPathAutoBrainstorm = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('autocontinue-brainstorm-mock', {
  name: 'autocontinue-brainstorm-mock',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPathAutoBrainstorm}"`,
  max_rounds: 3,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=autocontinue-brainstorm-mock',
  '--autocontinue',
])
const autocontinueBrainstormOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'brainstorm autocontinue exits 0 for approved verdict', result.stderr)
assert(autocontinueBrainstormOutput.includes('Autocontinue requested'), 'brainstorm autocontinue prints autocontinue section')
assert(autocontinueBrainstormOutput.includes('Continue immediately to breakdown and implementation'), 'brainstorm autocontinue tells agent to continue to breakdown and implementation')
assert(autocontinueBrainstormOutput.includes('specdev reviewloop implementation --reviewer=autocontinue-brainstorm-mock --autocontinue'), 'brainstorm autocontinue preserves reviewer for implementation review')
assert(autocontinueBrainstormOutput.includes('"autocontinue"'), 'brainstorm autocontinue prints a JSON continuation contract')
assert(autocontinueBrainstormOutput.includes('"next_phase": "breakdown"'), 'brainstorm autocontinue contract names breakdown as next phase')
assert(autocontinueBrainstormOutput.includes('"implementation_reviewer": "autocontinue-brainstorm-mock"'), 'brainstorm autocontinue contract stores reviewer')

console.log('\nreviewloop (implementation autocontinue approved):')
cleanup()
initProject()
fillBigPicture()
const aAutocontinueImplementation = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aAutocontinueImplementation, 'implementation'), { recursive: true })
mkdirSync(join(aAutocontinueImplementation, 'review'), { recursive: true })
writeFileSync(join(aAutocontinueImplementation, 'status.json'), JSON.stringify({ brainstorm_approved: true }), 'utf-8')
writeFileSync(join(aAutocontinueImplementation, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }), 'utf-8')
const feedbackRelPathAutoImplementation = `.specdev/assignments/${ASSIGNMENT_NAME}/review/implementation-feedback.md`
setupReviewer('autocontinue-implementation-mock', {
  name: 'autocontinue-implementation-mock',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPathAutoImplementation}"`,
  max_rounds: 3,
})
result = runCmd([
  'reviewloop',
  'implementation',
  `--target=${TEST_DIR}`,
  '--reviewer=autocontinue-implementation-mock',
  '--autocontinue',
])
const autocontinueImplementationOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'implementation autocontinue exits 0 for approved verdict', result.stderr)
assert(autocontinueImplementationOutput.includes('Autocontinue requested'), 'implementation autocontinue prints autocontinue section')
assert(autocontinueImplementationOutput.includes('Continue immediately to summary and knowledge capture'), 'implementation autocontinue tells agent to continue to capture')
assert(autocontinueImplementationOutput.includes('"next_phase": "capture"'), 'implementation autocontinue contract names capture as next phase')
```

**Step 2: Run test to verify it fails**
Run: `npm run test:reviewloop-command`
Expected: FAIL because the output has the human autocontinue text but no JSON continuation contract.

**Step 3: Write minimal implementation**
In `src/commands/reviewloop.js`, add a pure helper near `printAutocontinuePrompt`:

```js
function autocontinueContract(phase, reviewerNames) {
  const reviewerArg = reviewerNames.join(',')
  if (phase === 'brainstorm') {
    return {
      mode: 'autocontinue',
      next_phase: 'breakdown',
      continue: ['breakdown', 'implementation'],
      implementation_reviewer: reviewerArg,
      implementation_review_command: `specdev reviewloop implementation --reviewer=${reviewerArg} --autocontinue`,
    }
  }
  if (phase === 'implementation') {
    return {
      mode: 'autocontinue',
      next_phase: 'capture',
      continue: ['knowledge-capture'],
    }
  }
  return { mode: 'autocontinue', next_phase: null, continue: [] }
}
```

Then update `printAutocontinuePrompt` to print the contract after the existing prose:

```js
  console.log('   Contract:')
  console.log(JSON.stringify(autocontinueContract(phase, reviewerNames), null, 2).split('\n').map(line => `   ${line}`).join('\n'))
```

**Step 4: Run test to verify it passes**
Run: `npm run test:reviewloop-command`
Expected: PASS.

**Step 5: Commit**
Run: `git add src/commands/reviewloop.js tests/test-reviewloop-command.js && git commit -m "Add reviewloop autocontinue contract output"`

### Task 2: Update Source-of-Truth Agent Instructions
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify/Test `templates/.specdev/skills/core/reviewloop/SKILL.md`, `templates/.specdev/skills/core/implementing/SKILL.md`, `src/commands/init.js`, `src/commands/implement.js`, `tests/test-init.js`, `tests/test-reviewloop.js`

**Step 1: Write failing instruction tests**
In `tests/test-init.js`, after the existing `reviewloopSkill` assertions, add:

```js
assert(reviewloopSkill.includes('With `--autocontinue`: after approval, continue to the next workflow phase without another user prompt.'), 'reviewloop skill documents autocontinue')
assert(reviewloopSkill.includes('Do not stop after an approved autocontinue review'), 'reviewloop skill forbids stopping after autocontinue approval')
assert(reviewloopSkill.includes('implementation --reviewer=<name> --autocontinue'), 'reviewloop skill carries reviewer to implementation review')
```

In `tests/test-reviewloop.js`, after reading `skillContent`, add:

```js
assert(skillContent.includes('Do not stop after an approved autocontinue review'), 'core reviewloop skill forbids stopping after autocontinue approval')
assert(skillContent.includes('implementation --reviewer=<name> --autocontinue'), 'core reviewloop skill carries reviewer to implementation review')
```

**Step 2: Run tests to verify they fail**
Run: `npm run test:init && npm run test:reviewloop`
Expected: FAIL on missing stricter autocontinue instruction text.

**Step 3: Update template and generator text**
In `templates/.specdev/skills/core/reviewloop/SKILL.md`, add these bullets under the Flow section after the pass/fail rules:

```md
## Autocontinue Contract

When `--autocontinue` is present and the review is approved:

- Do not stop after an approved autocontinue review.
- For brainstorm approval, continue immediately to breakdown and implementation.
- Reuse the same reviewer for implementation review with `specdev reviewloop implementation --reviewer=<name> --autocontinue`.
- For implementation approval, continue immediately to summary and knowledge capture.
- If a reviewer returns `needs-changes`, run `specdev check-review`, address findings, write the changelog, and rerun reviewloop within max rounds.
```

Mirror the same assignment text inside the `specdev-reviewloop` string template in `src/commands/init.js`.

In `templates/.specdev/skills/core/implementing/SKILL.md`, update Phase 3 final review to distinguish normal mode from autocontinue mode:

```md
4. If this implementation was reached from `reviewloop brainstorm --autocontinue`, run `specdev checkpoint implementation`, then run `specdev reviewloop implementation --reviewer=<same-reviewer> --autocontinue` without asking the user for another decision.
5. Otherwise, tell the user their options:
   - `specdev reviewloop implementation` — automated external review
   - `specdev review implementation` — manual review in a separate session
   - `specdev approve implementation` — skip review and proceed to knowledge capture
6. Stop and wait only in the non-autocontinue path.
```

In `src/commands/implement.js`, change the final printed choice list so step 4 says autocontinue sessions should run `specdev checkpoint implementation` and `specdev reviewloop implementation --reviewer=<same-reviewer> --autocontinue` instead of presenting options.

**Step 4: Run tests to verify they pass**
Run: `npm run test:init && npm run test:reviewloop`
Expected: PASS.

**Step 5: Commit**
Run: `git add src/commands/init.js src/commands/implement.js templates/.specdev/skills/core/reviewloop/SKILL.md templates/.specdev/skills/core/implementing/SKILL.md tests/test-init.js tests/test-reviewloop.js && git commit -m "Teach agent skills to honor reviewloop autocontinue"`

### Task 3: Cover Checkpoint and End-to-End CLI Guidance
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Modify/Test `src/commands/checkpoint.js`, `tests/test-checkpoints.js`, `tests/test-reviewloop-command.js`, `package.json`

**Step 1: Write failing tests**
In `tests/test-checkpoints.js`, extend the existing brainstorm checkpoint assertions:

```js
assert(result.stdout.includes('Review, then continue if approved'), 'brainstorm checkpoint uses review-then-continue language')
assert(result.stdout.includes('Do not ask for free-form reviewer text'), 'brainstorm checkpoint reinforces bounded reviewer choices')
```

Add an implementation checkpoint case near the implementation checkpoint tests, or create one if absent:

```js
console.log('\nimplementation checkpoint — offers autocontinue review:')
const implDir = join(TEST_DIR, '.specdev', 'assignments', '006_feature_impl')
mkdirSync(join(implDir, 'implementation'), { recursive: true })
writeFileSync(join(implDir, 'status.json'), JSON.stringify({ brainstorm_approved: true }), 'utf-8')
writeFileSync(join(implDir, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }), 'utf-8')
setCurrent('006_feature_impl')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`])
assert(result.status === 0, 'implementation checkpoint passes with completed tasks')
assert(result.stdout.includes('Automated review, then continue if approved'), 'implementation checkpoint offers autocontinue review choice')
assert(result.stdout.includes('specdev reviewloop implementation --reviewer=<name> --autocontinue'), 'implementation checkpoint prints autocontinue command')
```

In `tests/test-reviewloop-command.js`, after the autocontinue tests from Task 1, assert single-phase behavior is unchanged:

```js
assert(!passOutput.includes('Autocontinue requested'), 'reviewloop without autocontinue does not print autocontinue section')
```

**Step 2: Run tests to verify failures**
Run: `npm run test:checkpoints && npm run test:reviewloop-command`
Expected: FAIL only where output text has not yet been updated or where the new regression assertion exposes accidental behavior.

**Step 3: Implement final CLI wording and release date**
In `src/commands/checkpoint.js`, ensure both brainstorm and implementation checkpoint output keep these exact properties:

```js
console.log(`   1. Automated review, then continue if approved — choose a reviewer, then run specdev reviewloop ${reviewPhase}${discussionArg} --reviewer=<name> --autocontinue`)
console.log('   Use one choice per reviewer config; do not ask for free-form reviewer text.')
```

For implementation, keep:

```js
console.log('   1. Automated review, then continue if approved — choose a reviewer, then run specdev reviewloop implementation --reviewer=<name> --autocontinue')
```

Before the final commit, update `package.json` `releaseDate` to `2026-05-11`.

**Step 4: Run targeted and broad verification**
Run: `npm run test:checkpoints && npm run test:reviewloop-command && npm run test:init && npm run test:reviewloop`
Expected: PASS.

Run: `npm test`
Expected: PASS.

**Step 5: Commit**
Run: `git add src/commands/checkpoint.js tests/test-checkpoints.js tests/test-reviewloop-command.js package.json && git commit -m "Cover autocontinue checkpoint guidance"`
