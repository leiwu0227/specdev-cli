import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printBullets, printLines, printSection } from '../utils/output.js'

/**
 * specdev review <phase> — Phase-aware manual review (separate session)
 *
 * Requires an explicit phase argument: brainstorm or implementation.
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

  if (phase === 'breakdown') {
    console.error('Breakdown uses inline subagent review, not manual review')
    console.log('   Run specdev implement to proceed to implementation.')
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown review phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
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

  // Detect previous rounds from archived files
  const nextRound = await detectNextRound(reviewDir)

  // Show previous round context if available
  if (nextRound > 1) {
    const prevRound = nextRound - 1
    const updateFile = join(reviewDir, `update-round-${prevRound}.md`)
    const prevFeedback = join(reviewDir, `feedback-round-${prevRound}.md`)

    blankLine()
    printSection(`Re-review (round ${nextRound}):`)
    if (await fse.pathExists(updateFile)) {
      console.log(`   Changes since last review: ${name}/review/update-round-${prevRound}.md`)
    }
    if (await fse.pathExists(prevFeedback)) {
      console.log(`   Previous findings: ${name}/review/feedback-round-${prevRound}.md`)
    }
  }

  const feedbackPath = `${name}/review/review-feedback.md`

  blankLine()
  printSection('Write findings to:')
  console.log(`   ${feedbackPath}`)
  blankLine()
  printSection('Feedback format:')
  printLines([
    '  ```markdown',
    '  # Review Feedback',
    '  ',
    `  **Phase:** ${phase}`,
    '  **Verdict:** approved | needs-changes',
    `  **Round:** ${nextRound}`,
    '  ',
    '  ## Findings',
    '  - [list findings, or "None — approved"]',
    '  ',
    '  ## Addressed Findings',
    '  - [items fixed in this round, or "None"]',
    '  ```',
  ])
  blankLine()
  console.log(`Reviewing assignment: ${name}`)
  console.log('After writing findings, return to the main session and run:')
  console.log(`   specdev check-review --assignment=${name}`)
}

async function detectNextRound(reviewDir) {
  try {
    const files = await fse.readdir(reviewDir)
    let maxRound = 0
    for (const f of files) {
      const match = f.match(/^feedback-round-(\d+)\.md$/)
      if (match) {
        const n = Number.parseInt(match[1], 10)
        if (n > maxRound) maxRound = n
      }
    }
    return maxRound + 1
  } catch {
    return 1
  }
}
