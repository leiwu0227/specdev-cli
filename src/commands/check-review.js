import { join } from 'path'
import { writeSync, readdirSync } from 'fs'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printSection } from '../utils/output.js'
import { getLatestRound } from '../utils/review-feedback.js'
import { scanSingleAssignment } from '../utils/scan.js'
import { loadStateForAssignment } from '../utils/state.js'
import { commandPhases } from '../utils/workflow-contract.js'

const VALID_PHASES = commandPhases.checkReview

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
    const specdevPath = join(assignmentPath, '..', '..')
    const { detected } = await loadStateForAssignment(specdevPath, summary, assignmentPath)
    if (detected.state.startsWith('brainstorm')) {
      phase = 'brainstorm'
    } else {
      phase = 'implementation'
    }
  }

  if (!VALID_PHASES.includes(phase)) {
    const payload = {
      version: 1,
      status: 'error',
      error: 'unknown_phase',
      phase,
      valid_phases: VALID_PHASES,
    }
    if (json) {
      writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    } else {
      console.error(`Unknown check-review phase: ${phase}`)
      console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    }
    process.exitCode = 1
    return
  }

  const reviewDir = join(assignmentPath, 'review')

  // Determine feedback file path
  let feedbackPath
  let feedbackFilename

  if (flags.reviewer) {
    feedbackFilename = `${phase}-feedback-${flags.reviewer}.md`
    feedbackPath = join(reviewDir, feedbackFilename)
  } else {
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

  if (!(await fse.pathExists(feedbackPath))) {
    const payload = {
      version: 1,
      status: 'error',
      error: 'no_feedback',
      detail: `No review/${feedbackFilename} found`,
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
      detail: `${feedbackFilename} exists but contains no rounds`,
    }
    if (json) {
      writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    } else {
      console.error('No review feedback found')
      console.log(`   ${feedbackFilename} exists but contains no rounds`)
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
          ? `Run specdev approve ${phase}, then run specdev next --json and follow the returned action`
          : `Address findings, then append to review/${feedbackFilename.replace('-feedback', '-changelog')} under ## Round ${latest.round}`,
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
    console.log(`   Run specdev approve ${phase}`)
    console.log('   Then run specdev next --json and follow the returned action.')
  } else {
    printSection('Findings:')
    for (const finding of latest.findings) {
      console.log(`   - ${finding}`)
    }
    blankLine()

    printSection('Action required:')
    console.log('   1. Address each finding. Simplify, don\'t patch-stack.')
    console.log('      Consolidate layered fixes into clean solutions.')
    console.log('      Never patch special-case code just to fit tests — update tests if outdated.')
    console.log('   2. You MAY push back — mark as [REJECTED] with justification.')
    console.log('      Valid reasons: low cost-benefit, unlikely edge case, over-engineering, out of scope.')
    console.log(`   3. Append changes to: ${name}/review/${feedbackFilename.replace('-feedback', '-changelog')} under ## Round ${latest.round}`)
    console.log('   4. Say "auto review" or run specdev review in a separate session')
  }
}
