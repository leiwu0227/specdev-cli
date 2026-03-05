import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { parseReviewFeedback } from '../utils/review-feedback.js'
import { blankLine, printBullets, printLines, printSection } from '../utils/output.js'

/**
 * specdev review <phase> — Phase-aware review (separate session or automated)
 *
 * Requires an explicit phase argument: brainstorm or implementation.
 * Supports --round N for automated flows; auto-detects round otherwise.
 */
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
    console.error('specdev review done has been removed. The review agent should write findings directly to review/{phase}-feedback.md')
    process.exitCode = 1
    return
  }

  if (phase === 'breakdown') {
    console.error('Breakdown uses inline subagent review, not manual review')
    console.log('   Breakdown is handled automatically after specdev approve brainstorm.')
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown review phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  // Accept assignment as positional arg (e.g. specdev review brainstorm 1)
  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  console.log(`Manual Review: ${name}`)
  console.log(`   Phase: ${phase}`)
  blankLine()

  if (phase === 'brainstorm') {
    printSection('Review scope: Design completeness and feasibility')
    blankLine()
    printSection('Artifacts to review:')
    const artifacts = []
    if (await fse.pathExists(join(assignmentPath, 'brainstorm', 'proposal.md'))) {
      artifacts.push(`${name}/brainstorm/proposal.md`)
    }
    if (await fse.pathExists(join(assignmentPath, 'brainstorm', 'design.md'))) {
      artifacts.push(`${name}/brainstorm/design.md`)
    }
    printBullets(artifacts, '   - ')
    blankLine()
    printSection('Check:')
    printLines([
      '  1. Is the design complete? Any missing sections?',
      '  2. Is it feasible with the current tech stack?',
      '  3. Are edge cases and error handling addressed?',
      '  4. Is the scope appropriate (not too large)?',
    ])
  } else if (phase === 'implementation') {
    printSection('Review scope: Spec compliance + code quality')
    blankLine()
    printSection('Artifacts to review:')
    printBullets([
      `${name}/brainstorm/design.md (what was requested)`,
      `${name}/breakdown/plan.md (what was planned)`,
      'Changed code files (what was built)',
    ], '   - ')
    blankLine()
    printSection('Check:')
    printLines([
      '  1. Spec compliance: does implementation match the design?',
      '  2. Code quality: architecture, testing, style',
      '  3. Tag findings as CRITICAL or MINOR',
      '  4. Discuss findings with user before concluding',
    ])
  }

  // Ensure review/ directory exists
  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  // Detect round: use --round flag if provided, otherwise auto-detect from review-feedback.md
  const feedbackFilePath = join(reviewDir, `${phase}-feedback.md`)
  let nextRound
  const isAutomated = flags.round != null

  if (isAutomated) {
    nextRound = Number(flags.round)
  } else {
    // Auto-detect: count existing ## Round headers in review-feedback.md
    nextRound = 1
    if (await fse.pathExists(feedbackFilePath)) {
      const existingContent = await fse.readFile(feedbackFilePath, 'utf-8')
      const { rounds } = parseReviewFeedback(existingContent)
      nextRound = rounds.length + 1
    }
  }

  // Show previous round context if round 2+
  if (nextRound > 1) {
    blankLine()
    printSection(`Re-review (round ${nextRound}):`)
    console.log(`   Read previous findings: ${name}/review/${phase}-feedback.md`)
    console.log(`   Read changes since last round: ${name}/review/${phase}-changelog.md`)
  }

  const feedbackPath = `${name}/review/${phase}-feedback.md`

  blankLine()
  printSection('Write findings to:')
  console.log(`   ${feedbackPath}`)
  blankLine()
  printSection('Feedback format (append to file):')

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
  blankLine()
  console.log(`Reviewing assignment: ${name}`)
  blankLine()

  if (!isAutomated) {
    console.log('IMPORTANT: Do NOT run check-review in this session.')
    console.log('check-review is for the MAIN coding agent in a separate session.')
  }
}
