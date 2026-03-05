import { join } from 'path'
import { writeSync } from 'fs'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printSection } from '../utils/output.js'
import { getLatestRound } from '../utils/review-feedback.js'
import { scanSingleAssignment } from '../utils/scan.js'
import { detectAssignmentState } from '../utils/state.js'

/**
 * specdev check-review [phase] — Read and address review feedback
 *
 * Reads review/{phase}-feedback.md (append-only), parses the latest round
 * using the shared parser, and instructs the agent on next steps.
 *
 * Phase can be provided as a positional arg or inferred from assignment state.
 */
export async function checkReviewCommand(positionalArgs = [], flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const json = Boolean(flags.json)

  // Determine phase: positional arg or infer from assignment state
  let phase = positionalArgs[0]
  if (!phase) {
    const summary = await scanSingleAssignment(assignmentPath, name)
    const detected = await detectAssignmentState(summary, assignmentPath)
    if (detected.state.startsWith('brainstorm')) {
      phase = 'brainstorm'
    } else {
      phase = 'implementation'
    }
  }

  const reviewDir = join(assignmentPath, 'review')
  const feedbackPath = join(reviewDir, `${phase}-feedback.md`)

  if (!(await fse.pathExists(feedbackPath))) {
    const payload = {
      version: 1,
      status: 'error',
      error: 'no_feedback',
      detail: `No review/${phase}-feedback.md found`,
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
    const payload = {
      version: 1,
      status: 'error',
      error: 'no_feedback',
      detail: `${phase}-feedback.md exists but contains no rounds`,
    }
    if (json) {
      writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    } else {
      console.error('No review feedback found')
      console.log(`   ${phase}-feedback.md exists but contains no rounds`)
    }
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
      addressed_findings: latest.addressed,
      next_action:
        latest.verdict === 'approved'
          ? 'Run specdev approve <phase> to proceed'
          : `Address findings, then append to review/${phase}-changelog.md under ## Round ${latest.round}`,
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
    if (latest.addressed.length > 0) {
      blankLine()
      printSection('Addressed findings:')
      for (const finding of latest.addressed) {
        console.log(`   - ${finding}`)
      }
    }
    blankLine()
    printSection('Next step:')
    console.log('   Run specdev approve <phase> to proceed')
  } else {
    printSection('Findings:')
    for (const finding of latest.findings) {
      console.log(`   - ${finding}`)
    }
    blankLine()

    printSection('Action required:')
    console.log('   1. Address each finding in the phase artifacts')
    console.log(`   2. Append changes to: ${name}/review/${phase}-changelog.md under ## Round ${latest.round}`)
    console.log('   3. Say "auto review" or run specdev review in a separate session')
  }
}
