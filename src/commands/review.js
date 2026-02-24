import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printBullets, printLines, printSection } from '../utils/output.js'

/**
 * specdev review — Phase-aware manual review (separate session)
 *
 * Detects current phase from assignment artifacts and prints
 * appropriate review context for the reviewer.
 */
export async function reviewCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Detect phase from artifacts (latest phase wins)
  const hasImplementationDir = await fse.pathExists(join(assignmentPath, 'implementation'))
  const hasImplementationProgress = await fse.pathExists(
    join(assignmentPath, 'implementation', 'progress.json')
  )
  const hasImplementation = hasImplementationDir && hasImplementationProgress
  const hasPlan = await fse.pathExists(join(assignmentPath, 'breakdown', 'plan.md'))
  const hasDesign = await fse.pathExists(join(assignmentPath, 'brainstorm', 'design.md'))
  const hasProposal = await fse.pathExists(join(assignmentPath, 'brainstorm', 'proposal.md'))

  let phase
  if (hasImplementation) {
    phase = 'implementation'
  } else if (hasPlan) {
    // Breakdown review is handled by inline subagent, not manual review
    console.error('Manual review is not used after breakdown')
    console.log('   The breakdown plan is reviewed by an inline subagent.')
    console.log('   Run specdev implement to proceed to implementation.')
    process.exit(1)
  } else if (hasDesign || hasProposal) {
    phase = 'brainstorm'
  } else {
    console.error('No reviewable artifacts found')
    console.log('   Complete at least the brainstorm phase first')
    process.exit(1)
  }

  console.log(`Manual Review: ${name}`)
  console.log(`   Phase: ${phase}`)
  blankLine()

  if (phase === 'brainstorm') {
    printSection('Review scope: Design completeness and feasibility')
    blankLine()
    printSection('Artifacts to review:')
    const artifacts = []
    if (hasProposal) artifacts.push(`${name}/brainstorm/proposal.md`)
    if (hasDesign) artifacts.push(`${name}/brainstorm/design.md`)
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
    '  ```',
  ])
  blankLine()
  console.log('After writing findings, return to the main session and run: specdev check-review')
}

async function detectNextRound(reviewDir) {
  try {
    const files = await fse.readdir(reviewDir)
    let maxRound = 0
    for (const f of files) {
      const match = f.match(/^feedback-round-(\d+)\.md$/)
      if (match) {
        const n = parseInt(match[1], 10)
        if (n > maxRound) maxRound = n
      }
    }
    return maxRound + 1
  } catch {
    return 1
  }
}
