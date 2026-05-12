# Reviewloop Node Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bash-script-based reviewloop with a Node CLI command that orchestrates automated external reviews via `specdev review`, with append-only review artifacts, unified manual/automated format, and auto-approval on pass.

**Architecture:** The reviewloop Node command is a thin orchestrator: it resolves the assignment, spawns an external reviewer (e.g. codex) that runs `specdev review`, reads the verdict from append-only review artifacts, and either auto-approves or tells the main agent to fix findings. Two files with clear ownership: `review-feedback.md` (reviewer writes) and `changelog.md` (main agent writes).

**Tech Stack:** Node.js, fs-extra, child_process (spawn)

**Design doc:** `docs/plans/2026-03-04-reviewloop-node-command-design.md`

---

### Task 1: Create shared review-feedback parser utility

Shared utility for parsing `review/review-feedback.md` in the new append-only format. Used by reviewloop, check-review, and continue commands.

**Files:**
- Create: `src/utils/review-feedback.js`
- Test: `tests/test-review-feedback.js`

**Step 1: Write the failing test**

```js
// tests/test-review-feedback.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseReviewFeedback, getLatestRound, hasUnaddressedFindings } from '../src/utils/review-feedback.js'

describe('parseReviewFeedback', () => {
  it('returns empty result for null/empty content', () => {
    const result = parseReviewFeedback('')
    assert.deepStrictEqual(result, { rounds: [] })
  })

  it('parses single round with needs-changes', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Missing tests\n2. [F1.2] Bad naming\n\n### Addressed from changelog\n- (none — first round)\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds.length, 1)
    assert.equal(result.rounds[0].round, 1)
    assert.equal(result.rounds[0].verdict, 'needs-changes')
    assert.equal(result.rounds[0].findings.length, 2)
    assert.match(result.rounds[0].findings[0], /F1\.1/)
  })

  it('parses single round with approved verdict', () => {
    const content = `## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds[0].verdict, 'approved')
  })

  it('parses multiple rounds', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n\n## Round 2\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds.length, 2)
    assert.equal(result.rounds[0].verdict, 'needs-changes')
    assert.equal(result.rounds[1].verdict, 'approved')
  })
})

describe('getLatestRound', () => {
  it('returns null for empty content', () => {
    assert.equal(getLatestRound(''), null)
  })

  it('returns latest round data', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    const latest = getLatestRound(content)
    assert.equal(latest.round, 1)
    assert.equal(latest.verdict, 'needs-changes')
  })
})

describe('hasUnaddressedFindings', () => {
  it('returns false when no feedback file content', () => {
    assert.equal(hasUnaddressedFindings('', ''), false)
  })

  it('returns true when latest verdict is needs-changes and no changelog entry', () => {
    const feedback = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    assert.equal(hasUnaddressedFindings(feedback, ''), true)
  })

  it('returns false when latest verdict is needs-changes but changelog has matching round', () => {
    const feedback = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    const changelog = `## Round 1\n\n### Changes\n1. [F1.1] Fixed X\n`
    assert.equal(hasUnaddressedFindings(feedback, changelog), false)
  })

  it('returns false when latest verdict is approved', () => {
    const feedback = `## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    assert.equal(hasUnaddressedFindings(feedback, ''), false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-review-feedback.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```js
// src/utils/review-feedback.js

/**
 * Parse append-only review-feedback.md into structured rounds.
 * Each round has: { round, verdict, findings[], addressed[] }
 */
export function parseReviewFeedback(content) {
  if (!content || !content.trim()) return { rounds: [] }

  const rounds = []
  const roundSections = content.split(/^## Round /m).filter(Boolean)

  for (const section of roundSections) {
    const roundMatch = section.match(/^(\d+)/)
    if (!roundMatch) continue

    const round = parseInt(roundMatch[1], 10)
    const verdictMatch = section.match(/\*\*Verdict:\*\*\s*(.+)/i)
    const verdict = verdictMatch ? verdictMatch[1].trim().toLowerCase() : 'unknown'

    const findingsMatch = section.match(/### Findings\s*\n([\s\S]*?)(?=\n### |\n## |$)/i)
    const findings = extractBullets(findingsMatch ? findingsMatch[1] : '')

    const addressedMatch = section.match(/### Addressed from changelog\s*\n([\s\S]*?)(?=\n### |\n## |$)/i)
    const addressed = extractBullets(addressedMatch ? addressedMatch[1] : '')

    rounds.push({ round, verdict, findings, addressed })
  }

  return { rounds }
}

/**
 * Get the latest round from review-feedback.md content.
 * Returns null if no rounds found.
 */
export function getLatestRound(content) {
  const { rounds } = parseReviewFeedback(content)
  return rounds.length > 0 ? rounds[rounds.length - 1] : null
}

/**
 * Check if the latest round has needs-changes verdict without a matching
 * changelog entry. Used as a stale feedback guard.
 */
export function hasUnaddressedFindings(feedbackContent, changelogContent) {
  const latest = getLatestRound(feedbackContent)
  if (!latest || latest.verdict !== 'needs-changes') return false

  // Check if changelog has a matching ## Round N entry
  const changelogRoundPattern = new RegExp(`^## Round ${latest.round}\\b`, 'm')
  return !changelogRoundPattern.test(changelogContent || '')
}

function extractBullets(text) {
  const items = []
  for (const line of text.split('\n')) {
    if (!/^\s*[-*\d][\s.)]+/.test(line)) continue
    const trimmed = line.replace(/^\s*[-*\d][\s.)]+/, '').trim()
    if (trimmed && !trimmed.match(/^\(none/i)) {
      items.push(trimmed)
    }
  }
  return items
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-review-feedback.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/review-feedback.js tests/test-review-feedback.js
git commit -m "feat: add shared review-feedback parser utility"
```

---

### Task 2: Extract approve-phase helper

Extract the approve validation + status.json update from `approve.js` into a shared helper that both `approveCommand` and `reviewloop` can call.

**Files:**
- Create: `src/utils/approve-phase.js`
- Modify: `src/commands/approve.js:8-116`
- Test: `tests/test-approve-phase.js`

**Step 1: Write the failing test**

```js
// tests/test-approve-phase.js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import fse from 'fs-extra'
import { approvePhase } from '../src/utils/approve-phase.js'

const TEST_DIR = join(import.meta.dirname, 'test-approve-phase-output')

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, 'brainstorm'), { recursive: true })
  mkdirSync(join(TEST_DIR, 'implementation'), { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('approvePhase brainstorm', () => {
  it('fails when proposal.md is missing', async () => {
    writeFileSync(join(TEST_DIR, 'brainstorm', 'design.md'), 'A full design document here.')
    const result = await approvePhase(TEST_DIR, 'brainstorm')
    assert.equal(result.approved, false)
    assert.ok(result.errors.length > 0)
  })

  it('succeeds when both artifacts exist and are non-trivial', async () => {
    writeFileSync(join(TEST_DIR, 'brainstorm', 'proposal.md'), 'A complete proposal with details.')
    writeFileSync(join(TEST_DIR, 'brainstorm', 'design.md'), 'A full design document here.')
    const result = await approvePhase(TEST_DIR, 'brainstorm')
    assert.equal(result.approved, true)
    const status = await fse.readJson(join(TEST_DIR, 'status.json'))
    assert.equal(status.brainstorm_approved, true)
  })
})

describe('approvePhase implementation', () => {
  it('fails when progress.json is missing', async () => {
    const result = await approvePhase(TEST_DIR, 'implementation')
    assert.equal(result.approved, false)
  })

  it('succeeds when all tasks are completed', async () => {
    writeFileSync(
      join(TEST_DIR, 'implementation', 'progress.json'),
      JSON.stringify({ tasks: [{ status: 'completed' }, { status: 'completed' }] })
    )
    const result = await approvePhase(TEST_DIR, 'implementation')
    assert.equal(result.approved, true)
    const status = await fse.readJson(join(TEST_DIR, 'status.json'))
    assert.equal(status.implementation_approved, true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-approve-phase.js`
Expected: FAIL — module not found

**Step 3: Write the helper**

```js
// src/utils/approve-phase.js
import { join } from 'path'
import fse from 'fs-extra'

/**
 * Validate phase artifacts and update status.json.
 * Returns { approved: boolean, errors: string[] }
 */
export async function approvePhase(assignmentPath, phase) {
  const errors = []

  if (phase === 'brainstorm') {
    for (const file of ['brainstorm/proposal.md', 'brainstorm/design.md']) {
      const filePath = join(assignmentPath, file)
      if (!(await fse.pathExists(filePath))) {
        errors.push(`${file} (missing)`)
      } else {
        const content = await fse.readFile(filePath, 'utf-8')
        if (content.trim().length < 20) {
          errors.push(`${file} (empty or too short)`)
        }
      }
    }
  } else if (phase === 'implementation') {
    const progressPath = join(assignmentPath, 'implementation', 'progress.json')
    if (!(await fse.pathExists(progressPath))) {
      errors.push('implementation/progress.json (missing)')
    } else {
      try {
        const raw = await fse.readJson(progressPath)
        if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
          errors.push('No tasks found in progress.json')
        } else {
          const incomplete = raw.tasks.filter(t => t.status !== 'completed')
          if (incomplete.length > 0) {
            errors.push(`${incomplete.length} of ${raw.tasks.length} tasks not completed`)
          }
        }
      } catch {
        errors.push('progress.json is invalid')
      }
    }
  }

  if (errors.length > 0) {
    return { approved: false, errors }
  }

  // Update status.json
  const statusPath = join(assignmentPath, 'status.json')
  let status = {}
  if (await fse.pathExists(statusPath)) {
    try { status = await fse.readJson(statusPath) } catch { status = {} }
  }

  if (phase === 'brainstorm') {
    status.brainstorm_approved = true
  } else if (phase === 'implementation') {
    status.implementation_approved = true
  }

  await fse.writeJson(statusPath, status, { spaces: 2 })
  return { approved: true, errors: [] }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-approve-phase.js`
Expected: PASS

**Step 5: Refactor approve.js to use the helper**

Modify `src/commands/approve.js` — replace inline validation with `approvePhase()` call. Keep the same console output.

```js
// src/commands/approve.js — updated
import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine } from '../utils/output.js'
import { approvePhase } from '../utils/approve-phase.js'

const VALID_PHASES = ['brainstorm', 'implementation']

export async function approveCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev approve <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown approve phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  const result = await approvePhase(assignmentPath, phase)

  if (!result.approved) {
    console.error(`❌ Cannot approve ${phase} — checkpoint not met`)
    for (const err of result.errors) {
      console.log(`   Issue: ${err}`)
    }
    console.log(`   Run specdev checkpoint ${phase} first`)
    process.exitCode = 1
    return
  }

  if (phase === 'brainstorm') {
    console.log(`✅ Brainstorm approved for ${name}`)
    blankLine()
    console.log('Proceed to breakdown:')
    console.log('   1. Read .specdev/skills/core/breakdown/SKILL.md and follow it')
    console.log('   2. After plan review passes, run `specdev implement` to start implementation')
  } else if (phase === 'implementation') {
    console.log(`✅ Implementation approved for ${name}`)
    blankLine()
    console.log('Proceed to summary:')
    console.log('   Read .specdev/skills/core/knowledge-capture/SKILL.md and follow it')
  }
}
```

**Step 6: Run existing approve tests to verify no regression**

Run: `node --test tests/test-workflow.js`
Expected: PASS (approve is tested through workflow tests)

**Step 7: Commit**

```bash
git add src/utils/approve-phase.js tests/test-approve-phase.js src/commands/approve.js
git commit -m "refactor: extract approvePhase helper from approve command"
```

---

### Task 3: Rewrite check-review.js for append-only format

Replace archiving logic with simple read-and-present using the shared parser. Remove `safeArchiveName`, `feedback-round-N.md`, `update-round-N.md` logic.

**Files:**
- Modify: `src/commands/check-review.js:1-187` (full rewrite)
- Test: `tests/test-check-review.js`

**Step 1: Write the failing test**

```js
// tests/test-check-review.js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const CLI = join(import.meta.dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(import.meta.dirname, 'test-check-review-output')
const SPECDEV = join(TEST_DIR, '.specdev')
const ASSIGNMENTS = join(SPECDEV, 'assignments')

function setup(assignmentName, feedbackContent) {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(ASSIGNMENTS, assignmentName, 'review'), { recursive: true })
  mkdirSync(join(ASSIGNMENTS, assignmentName, 'brainstorm'), { recursive: true })
  mkdirSync(join(SPECDEV, 'project_notes'), { recursive: true })
  mkdirSync(join(SPECDEV, '_guides'), { recursive: true })
  writeFileSync(join(SPECDEV, 'project_notes', 'big_picture.md'), 'A real project description here.')
  if (feedbackContent) {
    writeFileSync(
      join(ASSIGNMENTS, assignmentName, 'review', 'review-feedback.md'),
      feedbackContent
    )
  }
}

function runCheckReview(args = []) {
  return spawnSync('node', [CLI, 'check-review', `--target=${TEST_DIR}`, ...args], {
    encoding: 'utf-8',
  })
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('check-review with append-only format', () => {
  const name = '00001_feature_test'

  it('shows findings for needs-changes verdict', () => {
    setup(name, `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Missing tests\n`)
    const result = runCheckReview([`--assignment=${name}`])
    assert.equal(result.status, 0)
    assert.ok(result.stdout.includes('F1.1'))
    assert.ok(result.stdout.includes('Missing tests'))
    assert.ok(result.stdout.includes('changelog.md'))
  })

  it('shows approved for approved verdict', () => {
    setup(name, `## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`)
    const result = runCheckReview([`--assignment=${name}`])
    assert.equal(result.status, 0)
    assert.ok(result.stdout.includes('approved'))
  })

  it('does not create feedback-round files', () => {
    setup(name, `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`)
    runCheckReview([`--assignment=${name}`])
    const { existsSync } = await import('node:fs')
    assert.ok(!existsSync(join(ASSIGNMENTS, name, 'review', 'feedback-round-1.md')))
  })

  it('does not delete review-feedback.md', () => {
    setup(name, `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`)
    runCheckReview([`--assignment=${name}`])
    const { existsSync } = await import('node:fs')
    assert.ok(existsSync(join(ASSIGNMENTS, name, 'review', 'review-feedback.md')))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-check-review.js`
Expected: FAIL — current check-review uses old format

**Step 3: Rewrite check-review.js**

```js
// src/commands/check-review.js
import { join } from 'path'
import { writeSync } from 'fs'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printSection } from '../utils/output.js'
import { getLatestRound } from '../utils/review-feedback.js'

export async function checkReviewCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const json = Boolean(flags.json)

  const reviewDir = join(assignmentPath, 'review')
  const feedbackPath = join(reviewDir, 'review-feedback.md')

  if (!(await fse.pathExists(feedbackPath))) {
    const payload = {
      version: 1,
      status: 'error',
      error: 'no_feedback',
      detail: 'No review/review-feedback.md found',
    }
    if (json) {
      writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    } else {
      console.error('No review feedback found')
      console.log('   Run specdev review in a separate session first')
    }
    process.exitCode = 1
    return
  }

  const content = await fse.readFile(feedbackPath, 'utf-8')
  const latest = getLatestRound(content)

  if (!latest) {
    console.error('Could not parse review-feedback.md — no ## Round headers found')
    process.exitCode = 1
    return
  }

  if (json) {
    const payload = {
      version: 1,
      status: 'ok',
      assignment: name,
      verdict: latest.verdict,
      round: latest.round,
      findings: latest.findings,
      next_action:
        latest.verdict === 'approved'
          ? nextStepForPhase(latest)
          : `Address findings, then append changes to review/changelog.md under ## Round ${latest.round}`,
    }
    writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    return
  }

  console.log(`Check Review: ${name}`)
  console.log(`   Round: ${latest.round}`)
  console.log(`   Verdict: ${latest.verdict}`)
  blankLine()

  if (latest.verdict === 'approved') {
    printSection('Review approved!')
    blankLine()
    printSection('Next step:')
    console.log(`   ${nextStepForPhase(latest)}`)
  } else {
    printSection('Findings:')
    for (const finding of latest.findings) {
      console.log(`   - ${finding}`)
    }
    blankLine()
    printSection('Action required:')
    console.log('   1. Address each finding in the phase artifacts')
    console.log(`   2. Append your changes to: ${name}/review/changelog.md under ## Round ${latest.round}`)
    console.log('   3. Run specdev reviewloop or specdev review for the next round')
  }
}

function nextStepForPhase(latest) {
  // We don't have phase in the new format directly, but findings context suffices
  return 'Run specdev approve <phase> to proceed'
}
```

Note: The `nextStepForPhase` function no longer has direct access to the phase field. We can either add phase detection from the feedback content, or keep the generic message. The approve command will validate the correct phase anyway.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-check-review.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/check-review.js tests/test-check-review.js
git commit -m "rewrite: check-review for append-only review format"
```

---

### Task 4: Modify review.js — unified format, --round flag, drop review done

Unify manual and automated review to use the same append-only format. Add `--round` flag. Remove `review done` subcommand. Remove `detectNextRound()` and per-round file references.

**Files:**
- Modify: `src/commands/review.js:1-206` (significant rewrite)

**Step 1: Rewrite review.js**

Key changes:
- Remove `reviewDoneCommand` function entirely
- Remove `detectNextRound` function
- Remove references to `feedback-round-N.md` and `update-round-N.md`
- Add `--round N` flag support (parse from `flags.round`)
- Auto-detect round from `review-feedback.md` if `--round` not provided
- Output unified format instructions with `## Round N`, `[FN.X]` tags
- On round 2+: instruct reviewer to read `changelog.md`
- When `--round` present: don't mention `specdev review done`

```js
// src/commands/review.js — key changes outline
// (Full implementation follows the patterns from existing code)

import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printBullets, printLines, printSection } from '../utils/output.js'
import { parseReviewFeedback } from '../utils/review-feedback.js'

export async function reviewCommand(positionalArgs = [], flags = {}) {
  const VALID_PHASES = ['brainstorm', 'implementation']
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev review <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (phase === 'done') {
    console.error('specdev review done has been removed')
    console.log('   The review agent should write findings directly to review/review-feedback.md')
    process.exitCode = 1
    return
  }

  // ... (keep existing phase validation, assignment resolution)

  // Determine round
  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  let round
  if (flags.round) {
    round = parseInt(flags.round, 10)
  } else {
    // Auto-detect from file
    const feedbackPath = join(reviewDir, 'review-feedback.md')
    if (await fse.pathExists(feedbackPath)) {
      const content = await fse.readFile(feedbackPath, 'utf-8')
      const { rounds } = parseReviewFeedback(content)
      round = rounds.length + 1
    } else {
      round = 1
    }
  }

  // Print phase-specific review scope (keep existing brainstorm/implementation logic)
  // ...

  // Show previous round context if round > 1
  if (round > 1) {
    blankLine()
    printSection(`Re-review (round ${round}):`)
    console.log(`   Read changelog.md for changes made since round ${round - 1}`)
    console.log(`   Read review-feedback.md for previous findings`)
  }

  // Print feedback format instructions
  blankLine()
  printSection('Write findings:')
  console.log(`   Append to: ${name}/review/review-feedback.md`)
  blankLine()
  printSection('Format:')
  printLines([
    '  ```markdown',
    `  ## Round ${round}`,
    '  ',
    '  **Verdict:** approved | needs-changes',
    '  ',
    '  ### Findings',
    `  1. [F${round}.1] Description of finding`,
    `  2. [F${round}.2] Another finding`,
    '  ',
    '  ### Addressed from changelog',
    round === 1 ? '  - (none — first round)' : '  - [FN.X] ✓ description of addressed item',
    '  ```',
  ])

  // Only show review done instruction for manual flow (no --round flag)
  if (!flags.round) {
    blankLine()
    console.log('IMPORTANT: Do NOT run check-review in this session.')
    console.log('check-review is for the MAIN coding agent in a separate session.')
  }
}
```

**Step 2: Run existing tests**

Run: `node --test tests/test-workflow.js`
Expected: PASS (may need test updates if tests check for old format output)

**Step 3: Commit**

```bash
git add src/commands/review.js
git commit -m "feat: unify review format, add --round flag, drop review done"
```

---

### Task 5: Modify continue.js — check verdict not just file existence

Replace file existence check with verdict-aware check using the shared parser.

**Files:**
- Modify: `src/commands/continue.js:35-37,76-88,109-113`

**Step 1: Update continue.js**

Replace:
```js
const feedbackPath = join(selected.path, 'review', 'review-feedback.md')
const hasReviewFeedback = await fse.pathExists(feedbackPath)
```

With:
```js
import { getLatestRound } from '../utils/review-feedback.js'

const feedbackPath = join(selected.path, 'review', 'review-feedback.md')
let reviewStatus = null // null = no review, 'needs-changes', 'approved'
if (await fse.pathExists(feedbackPath)) {
  const feedbackContent = await fse.readFile(feedbackPath, 'utf-8')
  const latest = getLatestRound(feedbackContent)
  if (latest && latest.verdict === 'needs-changes') {
    reviewStatus = 'needs-changes'
  }
  // If approved or unparseable, don't flag it
}
```

Update `buildContinuePayload` to use `reviewStatus` instead of `hasReviewFeedback`:
```js
review_feedback: reviewStatus === 'needs-changes' ? 'review/review-feedback.md' : null,
```

The emit function stays the same — it already handles `review_feedback` being null.

**Step 2: Run continue tests**

Run: `node --test tests/test-workflow.js`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/continue.js
git commit -m "fix: continue checks review verdict, not just file existence"
```

---

### Task 6: Rewrite reviewloop.js — Node command orchestrator

The core task. Replace the "signal to agent" with a full Node command that spawns the external reviewer, reads the verdict, and auto-approves on pass.

**Files:**
- Modify: `src/commands/reviewloop.js:1-103` (full rewrite)
- Test: `tests/test-reviewloop-command.js`

**Step 1: Write the failing test**

Test the command's argument handling, reviewer listing, stale guard, and verdict parsing. Mock the actual codex spawn.

```js
// tests/test-reviewloop-command.js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const CLI = join(import.meta.dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(import.meta.dirname, 'test-reviewloop-cmd-output')
const SPECDEV = join(TEST_DIR, '.specdev')
const ASSIGNMENTS = join(SPECDEV, 'assignments')
const REVIEWERS = join(SPECDEV, 'skills', 'core', 'reviewloop', 'reviewers')

function setup(assignmentName) {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(ASSIGNMENTS, assignmentName, 'brainstorm'), { recursive: true })
  mkdirSync(join(ASSIGNMENTS, assignmentName, 'review'), { recursive: true })
  mkdirSync(join(SPECDEV, 'project_notes'), { recursive: true })
  mkdirSync(join(SPECDEV, '_guides'), { recursive: true })
  mkdirSync(REVIEWERS, { recursive: true })
  writeFileSync(join(SPECDEV, 'project_notes', 'big_picture.md'), 'A real project description here.')
  writeFileSync(join(ASSIGNMENTS, assignmentName, 'brainstorm', 'proposal.md'), 'A full proposal.')
  writeFileSync(join(ASSIGNMENTS, assignmentName, 'brainstorm', 'design.md'), 'A full design document.')
}

function runReviewloop(args = []) {
  return spawnSync('node', [CLI, 'reviewloop', `--target=${TEST_DIR}`, ...args], {
    encoding: 'utf-8',
  })
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('reviewloop command', () => {
  const name = '00001_feature_test'

  it('exits with error when no phase given', () => {
    const result = runReviewloop([])
    assert.equal(result.status, 1)
  })

  it('lists reviewers and exits when --reviewer not given', () => {
    setup(name)
    writeFileSync(join(REVIEWERS, 'codex.json'), JSON.stringify({
      name: 'codex', command: 'echo test', max_rounds: 3
    }))
    const result = runReviewloop(['brainstorm', `--assignment=${name}`])
    assert.equal(result.status, 0)
    assert.ok(result.stdout.includes('codex'))
    assert.ok(result.stdout.includes('reviewer'))
  })

  it('blocks when stale feedback exists', () => {
    setup(name)
    writeFileSync(join(REVIEWERS, 'mock.json'), JSON.stringify({
      name: 'mock', command: 'echo test', max_rounds: 3
    }))
    writeFileSync(
      join(ASSIGNMENTS, name, 'review', 'review-feedback.md'),
      '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n'
    )
    const result = runReviewloop(['brainstorm', `--assignment=${name}`, '--reviewer=mock'])
    assert.equal(result.status, 1)
    assert.ok(result.stdout.includes('check-review') || result.stderr.includes('check-review'))
  })

  it('spawns reviewer and reads pass verdict', () => {
    setup(name)
    // Create a mock reviewer that writes a pass verdict to review-feedback.md
    const mockCmd = `echo '## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n' >> ${join(ASSIGNMENTS, name, 'review', 'review-feedback.md')}`
    writeFileSync(join(REVIEWERS, 'mock.json'), JSON.stringify({
      name: 'mock', command: mockCmd, max_rounds: 3
    }))
    const result = runReviewloop(['brainstorm', `--assignment=${name}`, '--reviewer=mock'])
    assert.ok(result.stdout.includes('passed') || result.stdout.includes('approved'))
    // Check that status.json was updated (auto-approve)
    const status = JSON.parse(readFileSync(join(ASSIGNMENTS, name, 'status.json'), 'utf-8'))
    assert.equal(status.brainstorm_approved, true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-reviewloop-command.js`
Expected: FAIL — current reviewloop just prints instructions

**Step 3: Write reviewloop.js**

```js
// src/commands/reviewloop.js
import { join } from 'path'
import { spawn } from 'child_process'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'
import { parseReviewFeedback, getLatestRound, hasUnaddressedFindings } from '../utils/review-feedback.js'
import { approvePhase } from '../utils/approve-phase.js'

const VALID_PHASES = ['brainstorm', 'implementation']

export async function reviewloopCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev reviewloop <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown reviewloop phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const targetDir = resolveTargetDir(flags)

  // Scan for available reviewers
  const reviewersDir = join(targetDir, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
  const reviewers = []
  if (await fse.pathExists(reviewersDir)) {
    const files = await fse.readdir(reviewersDir)
    for (const f of files) {
      if (f.endsWith('.json')) reviewers.push(f.replace('.json', ''))
    }
  }

  if (reviewers.length === 0) {
    console.error('❌ No reviewer configs found')
    console.log('   Add reviewer JSON configs to .specdev/skills/core/reviewloop/reviewers/')
    process.exitCode = 1
    return
  }

  // If no --reviewer flag, list and exit
  if (!flags.reviewer) {
    console.log(`Reviewloop: ${name}`)
    console.log(`   Phase: ${phase}`)
    blankLine()
    printSection('Available reviewers:')
    for (const r of reviewers) {
      console.log(`   - ${r}`)
    }
    blankLine()
    console.log('Ask the user which reviewer to use, then run:')
    console.log(`   specdev reviewloop ${phase} --reviewer=<name>`)
    return
  }

  // Validate reviewer exists
  const reviewerName = flags.reviewer
  const configPath = join(reviewersDir, `${reviewerName}.json`)
  if (!(await fse.pathExists(configPath))) {
    console.error(`❌ Reviewer config not found: ${reviewerName}`)
    console.log(`   Available: ${reviewers.join(', ')}`)
    process.exitCode = 1
    return
  }

  const config = await fse.readJson(configPath)
  const maxRounds = config.max_rounds || 3

  // Determine round
  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  const feedbackPath = join(reviewDir, 'review-feedback.md')
  const changelogPath = join(reviewDir, 'changelog.md')

  let feedbackContent = ''
  if (await fse.pathExists(feedbackPath)) {
    feedbackContent = await fse.readFile(feedbackPath, 'utf-8')
  }
  let changelogContent = ''
  if (await fse.pathExists(changelogPath)) {
    changelogContent = await fse.readFile(changelogPath, 'utf-8')
  }

  // Stale feedback guard
  if (hasUnaddressedFindings(feedbackContent, changelogContent)) {
    console.error('❌ Previous review findings have not been addressed')
    console.log('   Run specdev check-review to read findings and write changelog.md')
    process.exitCode = 1
    return
  }

  const { rounds } = parseReviewFeedback(feedbackContent)
  const round = rounds.length + 1

  // Check max rounds
  if (round > maxRounds) {
    console.error(`❌ Max rounds reached (${maxRounds})`)
    console.log('   Escalating to user. Review the findings manually.')
    process.exitCode = 1
    return
  }

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log(`   Reviewer: ${reviewerName}`)
  console.log(`   Round: ${round} / ${maxRounds}`)
  blankLine()

  // Spawn reviewer
  const env = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
  }

  const exitCode = await new Promise((resolve) => {
    const child = spawn('bash', ['-c', config.command], {
      cwd: targetDir,
      env,
      stdio: 'inherit',
    })
    child.on('close', resolve)
    child.on('error', () => resolve(1))
  })

  if (exitCode !== 0) {
    console.error(`❌ Reviewer command exited with code ${exitCode}`)
    process.exitCode = 1
    return
  }

  // Re-read feedback after reviewer ran
  if (!(await fse.pathExists(feedbackPath))) {
    console.error('❌ Reviewer did not write review-feedback.md')
    process.exitCode = 1
    return
  }

  const updatedContent = await fse.readFile(feedbackPath, 'utf-8')
  const latest = getLatestRound(updatedContent)

  if (!latest || latest.round !== round) {
    console.error(`❌ Expected ## Round ${round} in review-feedback.md but not found`)
    console.log('   The reviewer may not have written findings in the expected format.')
    console.log('   You can retry this round.')
    process.exitCode = 1
    return
  }

  blankLine()

  if (latest.verdict === 'approved') {
    console.log('✅ Review passed!')
    blankLine()
    const approveResult = await approvePhase(assignmentPath, phase)
    if (approveResult.approved) {
      console.log(`✅ ${phase} approved for ${name}`)
      if (phase === 'brainstorm') {
        console.log('   Proceed to breakdown.')
      } else if (phase === 'implementation') {
        console.log('   Proceed to summary.')
      }
    } else {
      console.error(`⚠ Review passed but approve failed:`)
      for (const err of approveResult.errors) {
        console.log(`   ${err}`)
      }
    }
  } else {
    console.log(`❌ Review round ${round} — needs changes`)
    blankLine()
    printSection('Findings:')
    for (const finding of latest.findings) {
      console.log(`   - ${finding}`)
    }
    blankLine()

    if (round >= maxRounds) {
      console.log('⚠ Max rounds reached. Escalating to user.')
      console.log('   Review the findings and decide how to proceed.')
    } else {
      console.log('Run specdev check-review to address findings.')
      console.log(`After fixing, run specdev reviewloop ${phase} --reviewer=${reviewerName} for round ${round + 1}.`)
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-reviewloop-command.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/reviewloop.js tests/test-reviewloop-command.js
git commit -m "feat: rewrite reviewloop as Node command with auto-approve"
```

---

### Task 7: Update help.js

Remove `review done` and update reviewloop description.

**Files:**
- Modify: `src/commands/help.js:26,29,62`

**Step 1: Edit help.js**

Remove:
```
'  review done         Validate feedback file and finish review session',
```
and:
```
'  specdev review done               # Validate feedback and finish review',
```

Update reviewloop description:
```
'  reviewloop <phase>  Automated external review via CLI (brainstorm | implementation)',
```

**Step 2: Commit**

```bash
git add src/commands/help.js
git commit -m "fix: remove review done from help, update reviewloop description"
```

---

### Task 8: Update templates — codex.json, SKILL.md, remove reviewloop.sh

Update template files to match the new design.

**Files:**
- Modify: `templates/.specdev/skills/core/reviewloop/reviewers/codex.json`
- Modify: `templates/.specdev/skills/core/reviewloop/SKILL.md`
- Remove: `templates/.specdev/skills/core/reviewloop/scripts/reviewloop.sh`
- Also update local: `.specdev/skills/core/reviewloop/reviewers/codex.json`
- Also update local: `.specdev/skills/core/reviewloop/SKILL.md`

**Step 1: Update codex.json**

```json
{
  "name": "codex",
  "command": "codex exec --full-auto --ephemeral \"Run specdev review $SPECDEV_PHASE --assignment $SPECDEV_ASSIGNMENT --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

**Step 2: Rewrite SKILL.md**

```markdown
---
name: reviewloop
description: Automated external review loop — spawns external CLI reviewer, reads verdict from artifacts, auto-approves on pass
type: core
phase: brainstorm, implement
input: Completed work (code changes, design docs, etc.)
output: Review verdict in review/review-feedback.md
next: auto-approve on pass, check-review on fail
triggers:
  - after brainstorm checkpoint passes
  - after implementation checkpoint passes
  - when user requests automated external review
---

# Reviewloop — Automated External Review

Run an external CLI reviewer (Codex, OpenCode, Aider, etc.) against the current assignment. The CLI command handles all mechanics: spawn reviewer, read verdict from artifacts, enforce round limits, auto-approve on pass.

## Usage

```bash
specdev reviewloop <phase>
specdev reviewloop <phase> --reviewer=<name>
```

Without `--reviewer`: lists available reviewers. Ask the user to select one.
With `--reviewer`: spawns the reviewer and processes the result.

## Review Artifacts

Two append-only files with clear ownership:

- `review/review-feedback.md` — review agent writes findings (append `## Round N`)
- `review/changelog.md` — main agent writes what it fixed (append `## Round N`)

Each agent only writes to its own file and reads the other's.

## Flow

1. Run `specdev reviewloop <phase>` — lists reviewers
2. Ask user which reviewer to use
3. Run `specdev reviewloop <phase> --reviewer=<name>`
4. Command spawns reviewer, waits for completion
5. Reads verdict from `review/review-feedback.md`
6. **Pass** → auto-approves phase, proceed to next phase
7. **Fail** → run `specdev check-review` to read findings, fix issues, write `changelog.md`
8. Re-run `specdev reviewloop` for next round

## Hard Rules

1. **Never skip check-review** — always read findings before the next round
2. **Never argue with findings** — fix what the reviewer says or escalate to the user
3. **Never exceed max rounds** — when max is reached, stop and defer to the user
```

**Step 3: Remove reviewloop.sh**

```bash
rm templates/.specdev/skills/core/reviewloop/scripts/reviewloop.sh
rmdir templates/.specdev/skills/core/reviewloop/scripts 2>/dev/null || true
```

**Step 4: Copy updated templates to local .specdev**

```bash
cp templates/.specdev/skills/core/reviewloop/reviewers/codex.json .specdev/skills/core/reviewloop/reviewers/codex.json
cp templates/.specdev/skills/core/reviewloop/SKILL.md .specdev/skills/core/reviewloop/SKILL.md
rm -rf .specdev/skills/core/reviewloop/scripts
```

**Step 5: Commit**

```bash
git add templates/.specdev/skills/core/reviewloop/ .specdev/skills/core/reviewloop/
git rm templates/.specdev/skills/core/reviewloop/scripts/reviewloop.sh
git commit -m "feat: update reviewloop templates for Node command"
```

---

### Task 9: Update update.js — cleanup old scripts

Add `skills/core/reviewloop/scripts` to removePaths so `specdev update` cleans up old bash scripts from existing installations.

**Files:**
- Modify: `src/utils/update.js:29-36`

**Step 1: Add to removePaths**

Add `'skills/core/reviewloop/scripts'` to the `removePaths` array in `updateSpecdevSystem()`.

**Step 2: Run update tests**

Run: `node --test tests/test-update.js`
Expected: PASS

**Step 3: Commit**

```bash
git add src/utils/update.js
git commit -m "fix: clean up old reviewloop scripts on specdev update"
```

---

### Task 10: Update existing tests

Update `tests/test-reviewloop.js` to remove bash script tests (the script no longer exists) and keep/update the install tests. Update any other tests that reference old review format.

**Files:**
- Modify: `tests/test-reviewloop.js` (remove script tests, keep install tests)
- Check: `tests/test-workflow.js` for review-related tests

**Step 1: Update test-reviewloop.js**

Remove all `reviewloop.sh` script tests (lines 1-173). Keep the install tests (lines 175-210) but update:
- Remove assertion for `reviewloop.sh` script existence (it's been removed)
- Keep assertions for SKILL.md, codex.json, core path

**Step 2: Run all tests**

Run: `node --test tests/`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/test-reviewloop.js
git commit -m "test: update reviewloop tests for Node command rewrite"
```

---

### Task 11: Final integration test — run specdev update and verify

Verify the full update path works correctly for existing installations.

**Step 1: Run specdev update in specdev-cli itself**

Run: `node bin/specdev.js update`
Expected: No errors, reviewloop scripts cleaned up

**Step 2: Run specdev update in dataportal**

Run: `cd /mnt/h/oceanwave/lib/dataportal && node /mnt/h/oceanwave/lib/specdev-cli/bin/specdev.js update`
Expected: No errors, clean output, codex reviewer found

**Step 3: Run full test suite**

Run: `node --test tests/`
Expected: ALL PASS

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test: verify integration after reviewloop rewrite"
```
