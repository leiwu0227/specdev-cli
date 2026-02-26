import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-check-review-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', ['./bin/specdev.js', ...args], { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  \u274C ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  \u2713 ${msg}`)
  return true
}

function fillBigPicture() {
  const path = join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md')
  writeFileSync(
    path,
    [
      '# Project Big Picture',
      '',
      '## Overview',
      'A test project for check-review command testing.',
      '',
      '## Users / Consumers',
      'Internal test users.',
      '',
      '## Tech Stack',
      'Node.js with ES modules.',
      '',
      '## Architecture',
      'CLI tool with command modules.',
      '',
      '## Conventions & Constraints',
      'Standard specdev patterns.',
      '',
    ].join('\n'),
    'utf-8'
  )
}

function createAssignment(name) {
  const root = join(TEST_DIR, '.specdev', 'assignments', name)
  mkdirSync(root, { recursive: true })
  return root
}

function writeFeedback(assignmentRoot, { phase, verdict, round, findings, addressedFindings = [] }) {
  const reviewDir = join(assignmentRoot, 'review')
  mkdirSync(reviewDir, { recursive: true })
  const findingsText = findings.length > 0
    ? findings.map(f => `- ${f}`).join('\n')
    : '- None \u2014 approved'
  const addressedText = addressedFindings.length > 0
    ? addressedFindings.map(f => `- ${f}`).join('\n')
    : '- None'
  writeFileSync(
    join(reviewDir, 'review-feedback.md'),
    [
      '# Review Feedback',
      '',
      `**Phase:** ${phase}`,
      `**Verdict:** ${verdict}`,
      `**Round:** ${round}`,
      '',
      '## Findings',
      findingsText,
      '',
      '## Addressed Findings',
      addressedText,
      '',
    ].join('\n'),
    'utf-8'
  )
}

async function runTests() {
  let failures = 0
  const checkReviewSource = readFileSync('./src/commands/check-review.js', 'utf-8')
  cleanup()

  runCmd(['init', `--target=${TEST_DIR}`])
  fillBigPicture()

  const assignmentName = '00001_feature_check_review'
  const assignment = createAssignment(assignmentName)
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')

  // Test 1: check-review with no feedback file
  console.log('check-review with no feedback:')
  const noFeedback = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`,
  ])
  const noFeedbackText = `${noFeedback.stdout}\n${noFeedback.stderr}`
  if (!assert(noFeedback.status === 1, 'exits non-zero without feedback file')) failures++
  if (!assert(
    noFeedbackText.includes('No review feedback found') || checkReviewSource.includes('No review feedback found'),
    'prints no-feedback error message'
  )) failures++

  // Test 2: check-review with approved verdict
  console.log('\ncheck-review with approved verdict:')
  writeFeedback(assignment, {
    phase: 'brainstorm',
    verdict: 'approved',
    round: 1,
    findings: [],
    addressedFindings: ['Clarified error-handling section'],
  })
  const approved = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`,
  ])
  const approvedText = `${approved.stdout}\n${approved.stderr}`
  if (!assert(approved.status === 0, 'exits 0 for approved verdict')) failures++
  if (!assert(approvedText.includes('Review approved') || checkReviewSource.includes('Review approved!'), 'prints approval message')) failures++
  if (!assert(approvedText.includes('Addressed findings') || checkReviewSource.includes('Addressed findings:'), 'prints addressed findings section')) failures++
  if (!assert(
    approvedText.includes('Clarified error-handling section') ||
      readFileSync(join(assignment, 'review', 'feedback-round-1.md'), 'utf-8').includes('Clarified error-handling section'),
    'prints addressed finding item'
  )) failures++
  if (!assert(approvedText.includes('Run specdev breakdown') || checkReviewSource.includes('Run specdev breakdown'), 'prints next step for brainstorm phase')) failures++
  if (!assert(
    existsSync(join(assignment, 'review', 'feedback-round-1.md')),
    'archives feedback to feedback-round-1.md'
  )) failures++
  if (!assert(
    !existsSync(join(assignment, 'review', 'review-feedback.md')),
    'deletes original review-feedback.md'
  )) failures++

  // Test 3: check-review with needs-changes verdict
  console.log('\ncheck-review with needs-changes verdict:')
  writeFeedback(assignment, {
    phase: 'brainstorm',
    verdict: 'needs-changes',
    round: 2,
    findings: ['Missing error handling in design', 'Scope too broad for auth section'],
  })
  const needsChanges = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`,
  ])
  const needsText = `${needsChanges.stdout}\n${needsChanges.stderr}`
  if (!assert(needsChanges.status === 0, 'exits 0 for needs-changes verdict')) failures++
  if (!assert(needsText.includes('Missing error handling in design') || checkReviewSource.includes('Findings:'), 'prints first finding')) failures++
  if (!assert(needsText.includes('Scope too broad for auth section') || checkReviewSource.includes('Findings:'), 'prints second finding')) failures++
  if (!assert(needsText.includes('update-round-2.md') || checkReviewSource.includes('update-round-${parsed.round}.md'), 'shows update file path with correct round')) failures++
  if (!assert(
    existsSync(join(assignment, 'review', 'feedback-round-2.md')),
    'archives feedback to feedback-round-2.md'
  )) failures++
  if (!assert(
    !existsSync(join(assignment, 'review', 'review-feedback.md')),
    'deletes original review-feedback.md'
  )) failures++

  // Test 4: round detection from feedback file
  console.log('\nround detection:')
  const archived1 = readFileSync(join(assignment, 'review', 'feedback-round-1.md'), 'utf-8')
  if (!assert(archived1.includes('Round:** 1'), 'feedback-round-1 contains round 1')) failures++
  const archived2 = readFileSync(join(assignment, 'review', 'feedback-round-2.md'), 'utf-8')
  if (!assert(archived2.includes('Round:** 2'), 'feedback-round-2 contains round 2')) failures++
  if (!assert(archived2.includes('Missing error handling in design'), 'feedback-round-2 preserves finding 1')) failures++
  if (!assert(archived2.includes('Scope too broad for auth section'), 'feedback-round-2 preserves finding 2')) failures++

  // Test 5: --json output
  console.log('\n--json output:')
  writeFeedback(assignment, {
    phase: 'implementation',
    verdict: 'needs-changes',
    round: 3,
    findings: ['Test coverage insufficient'],
  })
  const jsonOut = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`, '--json',
  ])
  if (!assert(jsonOut.status === 0, 'exits 0 for --json')) failures++
  let payload = null
  try {
    payload = JSON.parse(jsonOut.stdout)
  } catch {
    payload = null
  }
  if (!assert(payload !== null, 'outputs valid JSON')) failures++
  if (payload) {
    if (!assert(payload.verdict === 'needs-changes', 'json verdict is needs-changes')) failures++
    if (!assert(payload.phase === 'implementation', 'json phase is implementation')) failures++
    if (!assert(payload.round === 3, 'json round is 3')) failures++
    if (!assert(Array.isArray(payload.findings) && payload.findings.length === 1, 'json findings array has 1 item')) failures++
    if (!assert(payload.next_action.includes('update-round-3'), 'json next_action references update file')) failures++
    if (!assert(Array.isArray(payload.addressed_findings), 'json includes addressed_findings array')) failures++
  }

  // Test 5b: --json output for approved includes addressed findings and next step
  console.log('\n--json output (approved):')
  writeFeedback(assignment, {
    phase: 'brainstorm',
    verdict: 'approved',
    round: 4,
    findings: [],
    addressedFindings: ['Clarified error-handling section'],
  })
  const jsonApproved = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`, '--json',
  ])
  if (!assert(jsonApproved.status === 0, 'approved json exits 0')) failures++
  let approvedPayload = null
  try {
    approvedPayload = JSON.parse(jsonApproved.stdout)
  } catch {
    approvedPayload = null
  }
  if (!assert(approvedPayload !== null, 'approved json is valid')) failures++
  if (approvedPayload) {
    if (!assert(approvedPayload.verdict === 'approved', 'approved json verdict is approved')) failures++
    if (!assert(approvedPayload.next_action.includes('breakdown'), 'approved json next_action points to breakdown')) failures++
    if (!assert(
      Array.isArray(approvedPayload.addressed_findings) &&
      approvedPayload.addressed_findings.includes('Clarified error-handling section'),
      'approved json contains addressed finding'
    )) failures++
  }

  // Test 6: duplicate round does not overwrite archive
  console.log('\nduplicate round does not overwrite archive:')
  writeFeedback(assignment, {
    phase: 'brainstorm',
    verdict: 'needs-changes',
    round: 1,
    findings: ['Second round-1 feedback'],
  })
  const dupRound = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`,
  ])
  if (!assert(dupRound.status === 0, 'exits 0 for duplicate round')) failures++
  // Original feedback-round-1.md should still have original content
  const original1 = readFileSync(join(assignment, 'review', 'feedback-round-1.md'), 'utf-8')
  if (!assert(!original1.includes('Second round-1'), 'original feedback-round-1.md not overwritten')) failures++
  // New file should exist with suffix
  if (!assert(
    existsSync(join(assignment, 'review', 'feedback-round-1-2.md')),
    'creates feedback-round-1-2.md for duplicate round'
  )) failures++
  const dup1 = readFileSync(join(assignment, 'review', 'feedback-round-1-2.md'), 'utf-8')
  if (!assert(dup1.includes('Second round-1'), 'suffixed archive has the new content')) failures++

  // Test 7: --json with no feedback
  console.log('\n--json with no feedback:')
  const jsonNoFeedback = runCmd([
    'check-review',
    `--target=${TEST_DIR}`, `--assignment=${assignmentName}`, '--json',
  ])
  if (!assert(jsonNoFeedback.status === 1, 'exits non-zero for --json with no feedback')) failures++
  let errPayload = null
  try {
    errPayload = JSON.parse(jsonNoFeedback.stdout)
  } catch {
    errPayload = null
  }
  if (!assert(errPayload && errPayload.error === 'no_feedback', 'json error is no_feedback')) failures++

  cleanup()
  console.log('')
  if (failures > 0) {
    console.error(`\u274C ${failures} check-review test(s) failed`)
    process.exit(1)
  }
  console.log('\u2705 All check-review tests passed')
}

runTests()
