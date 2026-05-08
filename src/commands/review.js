import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { parseReviewFeedback } from '../utils/review-feedback.js'
import { blankLine, printBullets, printLines, printSection } from '../utils/output.js'

const VALID_PHASES = ['brainstorm', 'implementation', 'discussion']

const COST_BENEFIT_LINES = [
  '  Only flag issues worth the cost of fixing. Skip unlikely edge cases,',
  '  speculative future-proofing, and stylistic preferences.',
  '  Accept [REJECTED] findings unless they would cause a real bug.',
]

function printPhaseHeader({ name, phase, scope, artifacts, checks }) {
  printSection(`Review scope: ${scope}`)
  blankLine()
  printSection('Artifacts to review:')
  printBullets(artifacts, '   - ')
  blankLine()
  printSection('Check:')
  printLines(checks)
  blankLine()
  printSection('Cost-benefit principle:')
  printLines(COST_BENEFIT_LINES)

  const focus = process.env.SPECDEV_FOCUS
  if (focus) {
    blankLine()
    printSection('Review Focus:')
    console.log(`   ${focus}`)
  }
}

function printFeedbackFormat(nextRound) {
  const addressedExample = nextRound === 1
    ? '  - (none -- first round)'
    : '  - [FN.X] description of addressed finding'

  printLines([
    '  ```markdown',
    `  ## Round ${nextRound}`,
    '  ',
    '  **Verdict:** approved | needs-changes',
    '  ',
    '  ### Findings',
    `  1. [F${nextRound}.1] Description of finding`,
    '  ',
    '  ### Addressed from changelog',
    addressedExample,
    '  ```',
  ])
}

async function detectRound(reviewDir, feedbackFilename, flags) {
  const feedbackFilePath = join(reviewDir, feedbackFilename)
  if (flags.round != null) return Number(flags.round)

  let nextRound = 1
  if (await fse.pathExists(feedbackFilePath)) {
    const content = await fse.readFile(feedbackFilePath, 'utf-8')
    const { rounds } = parseReviewFeedback(content)
    nextRound = rounds.length + 1
  }
  return nextRound
}

async function collectBrainstormArtifacts(assignmentPath, name) {
  const artifacts = []
  if (await fse.pathExists(join(assignmentPath, 'brainstorm', 'proposal.md'))) {
    artifacts.push(`${name}/brainstorm/proposal.md`)
  }
  if (await fse.pathExists(join(assignmentPath, 'brainstorm', 'design.md'))) {
    artifacts.push(`${name}/brainstorm/design.md`)
  }
  return artifacts
}

/**
 * specdev review <phase> — Phase-aware review (separate session or automated)
 */
export async function reviewCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'review', version: 1, status: 'error', error: 'Missing required phase argument' }, null, 2))
    } else {
      console.error('Missing required phase argument')
      console.log(`   Usage: specdev review <${VALID_PHASES.join(' | ')}>`)
    }
    process.exitCode = 1
    return
  }

  if (phase === 'done') {
    console.error('specdev review done has been removed. Write findings directly to review/{phase}-feedback.md')
    process.exitCode = 1
    return
  }

  if (phase === 'breakdown') {
    console.error('Breakdown uses inline subagent review, not manual review')
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown review phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  let assignmentPath, name, feedbackPhase

  if (phase === 'discussion') {
    const discussionSelector = flags.discussion || process.env.SPECDEV_DISCUSSION
    if (!discussionSelector) {
      console.error('--discussion flag is required. Use specdev discussion --list to see available discussions.')
      process.exitCode = 1
      return
    }
    flags = { ...flags, discussion: discussionSelector }
    const targetDir = resolveTargetDir(flags)
    const specdevPath = join(targetDir, '.specdev')
    const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
    if (!resolved || resolved.error) {
      const msg = resolved?.error === 'malformed'
        ? `Invalid discussion ID "${flags.discussion}". Expected format: D00001`
        : `Discussion ${flags.discussion} not found.`
      console.error(msg)
      process.exitCode = 1
      return
    }
    assignmentPath = resolved.path
    name = resolved.name
    feedbackPhase = 'brainstorm'
  } else {
    assignmentPath = await resolveAssignmentPath(flags)
    name = assignmentName(assignmentPath)
    feedbackPhase = phase
  }

  const displayPhase = phase === 'discussion' ? 'discussion (brainstorm)' : phase

  if (flags.json) {
    const reviewDir = join(assignmentPath, 'review')
    await fse.ensureDir(reviewDir)
    const feedbackFilename = `${feedbackPhase}-feedback.md`
    const nextRound = await detectRound(reviewDir, feedbackFilename, flags)
    console.log(JSON.stringify({
      command: 'review',
      version: 1,
      status: 'ok',
      phase: displayPhase,
      assignment: name,
      feedback_file: `${name}/review/${feedbackFilename}`,
      round: nextRound,
    }, null, 2))
    return
  }

  console.log(`Manual Review: ${name}`)
  console.log(`   Phase: ${displayPhase}`)
  blankLine()

  if (phase === 'brainstorm' || phase === 'discussion') {
    const artifacts = await collectBrainstormArtifacts(assignmentPath, name)
    printPhaseHeader({
      name, phase,
      scope: 'Design completeness and feasibility',
      artifacts,
      checks: [
        '  1. Is the design complete? Any missing sections?',
        '  2. Is it feasible with the current tech stack?',
        '  3. Is the scope appropriate (not too large)?',
        '  4. ALWAYS scan the codebase to verify claims — never assume.',
        '     Read the actual files, grep for symbols, check dependencies.',
        '     Take eager effort to find answers; do not take shortcuts.',
      ],
    })
  } else {
    printPhaseHeader({
      name, phase,
      scope: 'Spec compliance + code quality',
      artifacts: [
        `${name}/brainstorm/design.md (what was requested)`,
        `${name}/breakdown/plan.md (what was planned)`,
        'Changed code files (what was built)',
      ],
      checks: [
        '  1. Spec compliance: does implementation match the design?',
        '  2. Code quality: architecture, testing, style',
        '  3. Tag findings as CRITICAL or MINOR',
        '  4. Prefer simplification over addition. If code can be made simpler',
        '     while preserving functionality, suggest that — not more code.',
        '     Flag patch-stacking: layered fixes that should be consolidated.',
        '  5. Flag special-case code that exists only to satisfy tests.',
        '     If tests are outdated, recommend updating the tests instead.',
      ],
    })
  }

  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  const feedbackFilename = `${feedbackPhase}-feedback.md`
  const nextRound = await detectRound(reviewDir, feedbackFilename, flags)
  const isAutomated = flags.round != null

  if (nextRound > 1) {
    blankLine()
    printSection(`Re-review (round ${nextRound}):`)
    console.log(`   Read previous findings: ${name}/review/${feedbackFilename}`)
    console.log(`   Read changes since last round: ${name}/review/${feedbackPhase}-changelog.md`)
  }

  blankLine()
  printSection('Write findings to:')
  console.log(`   ${name}/review/${feedbackFilename}`)
  if (isAutomated) {
    console.log(`   Automated review requirement: append ## Round ${nextRound} with **Verdict:** approved or **Verdict:** needs-changes before exiting.`)
    console.log('   Do not only print a summary to stdout.')
  }
  blankLine()
  printSection('Feedback format (append to file):')
  printFeedbackFormat(nextRound)
  blankLine()

  const label = phase === 'discussion' ? 'discussion' : 'assignment'
  console.log(`Reviewing ${label}: ${name}`)
  blankLine()

  if (!isAutomated) {
    console.log('IMPORTANT: Do NOT run check-review in this session.')
    console.log('check-review is for the MAIN coding agent in a separate session.')
  }
}
