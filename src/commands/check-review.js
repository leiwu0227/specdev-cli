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
      addressed_findings: parsed.addressedFindings,
      next_action:
        parsed.verdict === 'approved'
          ? nextStepForPhase(parsed.phase)
          : `Address findings, then fill in review/update-round-${parsed.round}.md`,
    }
    if (parsed.verdict !== 'approved') {
      // Create stub update file for structured consumers too
      const updateFilePath = join(reviewDir, `update-round-${parsed.round}.md`)
      const stub = [
        `# Update (Round ${parsed.round})`,
        '',
        '## Changes Made',
        '- [ ] TODO: describe what was changed and why',
        '',
        '## Files Modified',
        '- [ ] TODO: list modified files',
        '',
      ].join('\n')
      await fse.writeFile(updateFilePath, stub, 'utf-8')
      payload.update_file = `review/update-round-${parsed.round}.md`
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
    if (parsed.addressedFindings.length > 0) {
      blankLine()
      printSection('Addressed findings:')
      for (const finding of parsed.addressedFindings) {
        console.log(`   - ${finding}`)
      }
    }
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

    // Create stub update file so the agent has a concrete file to fill in
    const updateFileName = `update-round-${parsed.round}.md`
    const updateFilePath = join(reviewDir, updateFileName)
    const stub = [
      `# Update (Round ${parsed.round})`,
      '',
      '## Changes Made',
      '- [ ] TODO: describe what was changed and why',
      '',
      '## Files Modified',
      '- [ ] TODO: list modified files',
      '',
    ].join('\n')
    await fse.writeFile(updateFilePath, stub, 'utf-8')

    printSection('Action required:')
    console.log('   1. Address each finding in the phase artifacts')
    console.log(`   2. Fill in: ${name}/review/${updateFileName}`)
    console.log('   3. Say "auto review" or run specdev review in a separate session')
    blankLine()
    console.log(`   Stub created — update file is waiting at: ${name}/review/${updateFileName}`)
  }
}

function parseFeedback(content) {
  const phaseMatch = content.match(/\*\*Phase:\*\*\s*(.+)/i)
  const verdictMatch = content.match(/\*\*Verdict:\*\*\s*(.+)/i)
  const roundMatch = content.match(/\*\*Round:\*\*\s*(\d+)/i)

  const phase = phaseMatch ? phaseMatch[1].trim() : 'unknown'
  const verdict = verdictMatch ? verdictMatch[1].trim().toLowerCase() : 'unknown'
  const round = roundMatch ? Number.parseInt(roundMatch[1], 10) : 1

  const findings = extractSection(content, 'Findings', 'none — approved')
  const addressedFindings = extractSection(content, 'Addressed Findings', 'none')

  return { phase, verdict, round, findings, addressedFindings }
}

function extractSection(content, heading, sentinel) {
  const match = content.match(new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, 'i'))
  if (!match) return []
  const items = []
  for (const line of match[1].split('\n')) {
    if (!/^\s*[-*]\s+/.test(line)) continue
    const trimmed = line.replace(/^\s*[-*]\s+/, '').trim()
    if (trimmed && trimmed.toLowerCase() !== sentinel) {
      items.push(trimmed)
    }
  }
  return items
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
      return 'Run specdev approve brainstorm to proceed to breakdown and implementation'
    case 'implementation':
      return 'Run specdev approve implementation to proceed to summary'
    default:
      return 'Continue with the next workflow step'
  }
}
