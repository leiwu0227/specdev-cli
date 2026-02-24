import { join } from 'path'
import { writeSync } from 'fs'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printLines, printSection } from '../utils/output.js'

/**
 * specdev check-review — Read and address review feedback
 *
 * Reads review/review-feedback.md, prints findings, archives feedback,
 * and instructs agent on next steps based on verdict.
 */
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
  const parsed = parseFeedback(content)

  // Archive feedback (never overwrite existing archives)
  const archiveName = await safeArchiveName(reviewDir, parsed.round)
  await fse.copy(feedbackPath, join(reviewDir, archiveName))
  await fse.remove(feedbackPath)

  if (json) {
    const payload = {
      version: 1,
      status: 'ok',
      assignment: name,
      verdict: parsed.verdict,
      phase: parsed.phase,
      round: parsed.round,
      findings: parsed.findings,
      next_action:
        parsed.verdict === 'approved'
          ? nextStepForPhase(parsed.phase)
          : `Address findings, then write review/update-round-${parsed.round}.md`,
    }
    writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    return
  }

  console.log(`Check Review: ${name}`)
  console.log(`   Phase: ${parsed.phase}`)
  console.log(`   Round: ${parsed.round}`)
  console.log(`   Verdict: ${parsed.verdict}`)
  blankLine()

  if (parsed.verdict === 'approved') {
    printSection('Review approved!')
    blankLine()
    printSection('Next step:')
    console.log(`   ${nextStepForPhase(parsed.phase)}`)
    blankLine()
    console.log(`Archived feedback to: ${name}/review/${archiveName}`)
  } else {
    printSection('Findings:')
    for (const finding of parsed.findings) {
      console.log(`   - ${finding}`)
    }
    blankLine()
    console.log(`Archived feedback to: ${name}/review/${archiveName}`)
    blankLine()
    printSection('Action required:')
    console.log('   Address findings in the phase artifacts, then write a summary of changes:')
    blankLine()
    const updatePath = `${name}/review/update-round-${parsed.round}.md`
    console.log(`   File: ${updatePath}`)
    blankLine()
    printSection('Update file format:')
    printLines([
      '  ```markdown',
      `  # Update (Round ${parsed.round})`,
      '  ## Changes Made',
      '  - [what was changed and why]',
      '  ## Files Modified',
      '  - [list of modified files]',
      '  ```',
    ])
    blankLine()
    console.log('Then say "auto review" or run specdev review in a separate session.')
  }
}

function parseFeedback(content) {
  const phaseMatch = content.match(/\*\*Phase:\*\*\s*(.+)/i)
  const verdictMatch = content.match(/\*\*Verdict:\*\*\s*(.+)/i)
  const roundMatch = content.match(/\*\*Round:\*\*\s*(\d+)/i)

  const phase = phaseMatch ? phaseMatch[1].trim() : 'unknown'
  const verdict = verdictMatch ? verdictMatch[1].trim().toLowerCase() : 'unknown'
  const round = roundMatch ? parseInt(roundMatch[1], 10) : 1

  // Parse findings from ## Findings section
  const findings = []
  const findingsMatch = content.match(/## Findings\s*\n([\s\S]*?)(?=\n## |\n# |$)/)
  if (findingsMatch) {
    const lines = findingsMatch[1].split('\n')
    for (const line of lines) {
      const trimmed = line.replace(/^[-*]\s+/, '').trim()
      if (trimmed && trimmed.toLowerCase() !== 'none — approved') {
        findings.push(trimmed)
      }
    }
  }

  return { phase, verdict, round, findings }
}

async function safeArchiveName(reviewDir, round) {
  const base = `feedback-round-${round}.md`
  if (!(await fse.pathExists(join(reviewDir, base)))) {
    return base
  }
  // Round was reused — append a suffix to avoid overwriting
  for (let i = 2; i <= 100; i++) {
    const candidate = `feedback-round-${round}-${i}.md`
    if (!(await fse.pathExists(join(reviewDir, candidate)))) {
      return candidate
    }
  }
  return base // extremely unlikely fallback
}

function nextStepForPhase(phase) {
  switch (phase) {
    case 'brainstorm':
      return 'Run specdev breakdown to create an implementation plan'
    case 'breakdown':
      return 'Run specdev implement to begin implementation'
    case 'implementation':
      return 'Capture knowledge and close out the assignment'
    default:
      return 'Continue with the next workflow step'
  }
}
