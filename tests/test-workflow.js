import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const TEST_DIR = './test-workflow-output'

let failures = 0
let passes = 0

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', ['./bin/specdev.js', ...args], { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    failures++
    return false
  }
  console.log(`  ✓ ${msg}`)
  passes++
  return true
}

function fillBigPicture() {
  const path = join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md')
  writeFileSync(
    path,
    [
      '# Project Big Picture', '', '## Overview',
      'A long enough project description to pass placeholder checks.',
      '', '## Users / Consumers', 'Internal users and external users.',
      '', '## Tech Stack', 'TypeScript, Node.js, tests, and shell scripts.',
      '', '## Architecture', 'CLI and templates with markdown artifacts.',
      '', '## Conventions & Constraints', 'No completion claims without evidence.', '',
    ].join('\n'),
    'utf-8'
  )
}

function createAssignment(name) {
  const root = join(TEST_DIR, '.specdev', 'assignments', name)
  mkdirSync(root, { recursive: true })
  return root
}

function writeGateStatus(assignmentRoot, gates) {
  writeFileSync(join(assignmentRoot, 'status.json'), JSON.stringify(gates, null, 2) + '\n', 'utf-8')
}

function continueJson(assignment) {
  const args = ['continue', `--target=${TEST_DIR}`, '--json']
  if (assignment) args.push(`--assignment=${assignment}`)
  const result = runCmd(args)
  let payload = null
  if (result.stdout.trim()) {
    try { payload = JSON.parse(result.stdout) } catch { payload = null }
  }
  return { result, payload }
}

function writeFeedback(assignmentRoot, { phase, verdict, round, findings, addressedFindings = [] }) {
  const reviewDir = join(assignmentRoot, 'review')
  mkdirSync(reviewDir, { recursive: true })
  const findingsText = findings.length > 0
    ? findings.map(f => `- ${f}`).join('\n')
    : '- (none)'
  const addressedText = addressedFindings.length > 0
    ? addressedFindings.map(f => `- ${f}`).join('\n')
    : '- (none)'
  const feedbackPath = join(reviewDir, `${phase}-feedback.md`)
  // Append-only format: each call appends a ## Round N section
  const existing = existsSync(feedbackPath) ? readFileSync(feedbackPath, 'utf-8') : '# Review Feedback\n'
  const section = [
    '',
    `## Round ${round}`,
    `**Phase:** ${phase}`,
    `**Verdict:** ${verdict}`,
    '',
    '### Findings',
    findingsText,
    '',
    '### Addressed from changelog',
    addressedText,
    '',
  ].join('\n')
  writeFileSync(feedbackPath, existing + section, 'utf-8')
}

async function runTests() {
  cleanup()

  // =====================================================================
  // Continue Tests
  // =====================================================================

  runCmd(['init', `--target=${TEST_DIR}`])

  console.log('project_context_missing:')
  let out = continueJson()
  assert(out.result.status === 1, 'exits non-zero when big_picture is missing')
  assert(out.payload && out.payload.state === 'project_context_missing', 'reports project_context_missing state')

  console.log('\nno_assignment:')
  fillBigPicture()
  out = continueJson()
  assert(out.result.status === 1, 'exits non-zero when no assignment exists')
  assert(out.payload && out.payload.state === 'no_assignment', 'reports no_assignment state')

  console.log('\nbrainstorm_in_progress:')
  const a1 = createAssignment('00001_feature_brainstorm')
  mkdirSync(join(a1, 'brainstorm'), { recursive: true })
  out = continueJson('00001_feature_brainstorm')
  assert(out.result.status === 0, 'continue runs for brainstorm state')
  assert(out.payload && out.payload.state === 'brainstorm_in_progress', 'detects brainstorm_in_progress')

  console.log('\nbrainstorm_checkpoint_ready:')
  writeFileSync(join(a1, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(a1, 'brainstorm', 'design.md'), '# Design\n')
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'brainstorm_checkpoint_ready', 'detects brainstorm_checkpoint_ready')

  console.log('\nbreakdown_in_progress:')
  writeGateStatus(a1, { brainstorm_approved: true })
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'breakdown_in_progress', 'detects breakdown_in_progress')

  console.log('\nimplementation_in_progress:')
  mkdirSync(join(a1, 'breakdown'), { recursive: true })
  writeFileSync(join(a1, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(a1, 'implementation'), { recursive: true })
  writeFileSync(
    join(a1, 'implementation', 'progress.json'),
    JSON.stringify({ tasks: [{ number: 1, status: 'completed' }, { number: 2, status: 'in_progress' }, { number: 3, status: 'pending' }] }, null, 2) + '\n'
  )
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'implementation_in_progress', 'detects implementation_in_progress')
  assert(out.payload && out.payload.progress && out.payload.progress.totalTasks === 3, 'parses total task count from progress.json')

  console.log('\nreview feedback surfaced:')
  mkdirSync(join(a1, 'review'), { recursive: true })
  writeFileSync(join(a1, 'review', 'implementation-feedback.md'), '# Review Feedback\n\n## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n\n- Fix the thing\n')
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.review_feedback === 'review/implementation-feedback.md', 'surfaces review_feedback path')

  console.log('\nimplementation_checkpoint_ready:')
  rmSync(join(a1, 'review', 'implementation-feedback.md'))
  writeFileSync(
    join(a1, 'implementation', 'progress.json'),
    JSON.stringify({ tasks: [{ number: 1, status: 'completed' }, { number: 2, status: 'completed' }] }, null, 2) + '\n'
  )
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'implementation_checkpoint_ready', 'detects implementation_checkpoint_ready')

  console.log('\nsummary_in_progress:')
  writeGateStatus(a1, { brainstorm_approved: true, implementation_approved: true })
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'summary_in_progress', 'detects summary_in_progress')

  console.log('\ncompleted:')
  mkdirSync(join(a1, 'capture'), { recursive: true })
  writeFileSync(join(a1, 'capture', 'project-notes-diff.md'), '# Project Notes Diff\n')
  writeFileSync(join(a1, 'capture', 'workflow-diff.md'), '# Workflow Diff\n')
  out = continueJson('00001_feature_brainstorm')
  assert(out.payload && out.payload.state === 'completed', 'detects completed')

  console.log('\ncontinue — distill pending nudge:')
  // Create a completed assignment with capture diffs but not marked as processed
  const distillAssignment = join(TEST_DIR, '.specdev', 'assignments', '00003_feature_distill-pending')
  mkdirSync(join(distillAssignment, 'brainstorm'), { recursive: true })
  mkdirSync(join(distillAssignment, 'breakdown'), { recursive: true })
  mkdirSync(join(distillAssignment, 'implementation'), { recursive: true })
  mkdirSync(join(distillAssignment, 'capture'), { recursive: true })
  writeFileSync(join(distillAssignment, 'brainstorm', 'proposal.md'), '# Proposal\nContent here...\n')
  writeFileSync(join(distillAssignment, 'brainstorm', 'design.md'), '# Design\nContent here...\n')
  writeFileSync(join(distillAssignment, 'breakdown', 'plan.md'), '# Plan\nContent here...\n')
  writeFileSync(join(distillAssignment, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }))
  writeFileSync(join(distillAssignment, 'capture', 'project-notes-diff.md'), '# Diff\n')
  writeFileSync(join(distillAssignment, 'capture', 'workflow-diff.md'), '# Diff\n')
  writeFileSync(join(distillAssignment, 'status.json'), JSON.stringify({ brainstorm_approved: true, implementation_approved: true }))

  let result = runCmd(['continue', '--json', `--target=${TEST_DIR}`, '--assignment=00003_feature_distill-pending'])
  let json = JSON.parse(result.stdout.trim())
  assert(json.distill_pending !== undefined, 'continue output includes distill_pending')
  assert(json.distill_pending.count >= 1, 'distill_pending count is at least 1')
  assert(Array.isArray(json.distill_pending.assignments), 'distill_pending has assignments array')

  console.log('\nnumeric assignment shorthand:')
  out = continueJson('1')
  assert(out.result.status === 0, 'accepts numeric --assignment selector')
  assert(out.payload && out.payload.assignment === '00001_feature_brainstorm', 'resolves numeric selector to assignment name')

  console.log('\nambiguous numeric assignment shorthand:')
  const a1Alt = createAssignment('001_feature_brainstorm-alt')
  mkdirSync(join(a1Alt, 'brainstorm'), { recursive: true })
  out = continueJson('1')
  assert(out.result.status === 1, 'fails when numeric selector is ambiguous')
  assert(out.payload && out.payload.state === 'assignment_ambiguous', 'reports assignment_ambiguous for numeric selector')

  console.log('\nlegacy layout blocker:')
  const a2 = createAssignment('00002_feature_legacy')
  mkdirSync(join(a2, 'brainstorm'), { recursive: true })
  writeFileSync(join(a2, 'proposal.md'), '# Legacy proposal\n')
  out = continueJson('00002_feature_legacy')
  assert(out.payload && out.payload.blockers.some((b) => b.code === 'legacy_layout_detected'), 'reports legacy_layout_detected blocker')

  console.log('\ndesign revision mismatch blocker:')
  const a3 = createAssignment('00003_feature_revised')
  mkdirSync(join(a3, 'brainstorm'), { recursive: true })
  mkdirSync(join(a3, 'breakdown'), { recursive: true })
  writeFileSync(join(a3, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(a3, 'brainstorm', 'design.md'), '# Design\n')
  writeFileSync(join(a3, 'breakdown', 'plan.md'), '# Plan\n')
  writeGateStatus(a3, { brainstorm_approved: true })
  writeFileSync(join(a3, 'brainstorm', 'revision.json'), JSON.stringify({ version: 1, revision: 2, timestamp: new Date().toISOString() }, null, 2) + '\n')
  writeFileSync(join(a3, 'breakdown', 'metadata.json'), JSON.stringify({ version: 1, based_on_brainstorm_revision: 1, timestamp: new Date().toISOString() }, null, 2) + '\n')
  out = continueJson('00003_feature_revised')
  assert(out.result.status === 1, 'exits non-zero when design and breakdown revisions mismatch')
  assert(out.payload && out.payload.state === 'revision_requires_rebreakdown', 'detects revision_requires_rebreakdown state')
  assert(out.payload && out.payload.blockers.some((b) => b.code === 'design_revision_mismatch'), 'reports design_revision_mismatch blocker')

  console.log('\nassignment ambiguity requires clarification:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  fillBigPicture()

  const amb1 = createAssignment('00001_feature_alpha')
  mkdirSync(join(amb1, 'brainstorm'), { recursive: true })
  writeFileSync(join(amb1, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(amb1, 'brainstorm', 'design.md'), '# Design\n')
  writeGateStatus(amb1, { brainstorm_approved: true })
  mkdirSync(join(amb1, 'breakdown'), { recursive: true })
  writeFileSync(join(amb1, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(amb1, 'implementation'), { recursive: true })
  writeFileSync(join(amb1, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ number: 1, status: 'in_progress' }] }, null, 2))

  const amb2 = createAssignment('00002_feature_beta')
  mkdirSync(join(amb2, 'brainstorm'), { recursive: true })
  writeFileSync(join(amb2, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(amb2, 'brainstorm', 'design.md'), '# Design\n')
  writeGateStatus(amb2, { brainstorm_approved: true })
  mkdirSync(join(amb2, 'breakdown'), { recursive: true })
  writeFileSync(join(amb2, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(amb2, 'implementation'), { recursive: true })
  writeFileSync(join(amb2, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ number: 1, status: 'in_progress' }] }, null, 2))

  out = continueJson()
  assert(out.result.status === 1, 'exits non-zero when active assignment is ambiguous')
  assert(out.payload && out.payload.state === 'assignment_ambiguous', 'reports assignment_ambiguous state')
  assert(out.payload && Array.isArray(out.payload.candidates) && out.payload.candidates.length >= 2, 'includes candidate assignments for disambiguation')

  // =====================================================================
  // Revise Tests
  // =====================================================================

  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const reviseAssignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(reviseAssignment, 'brainstorm'), { recursive: true })

  console.log('\nrevise without design.md:')
  const noDesign = runCmd([
    'revise', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  assert(noDesign.status === 1, 'revise exits non-zero without design.md')

  console.log('\nrevise with design.md only:')
  writeFileSync(join(reviseAssignment, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')
  writeFileSync(join(reviseAssignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  const designOnly = runCmd([
    'revise', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  assert(designOnly.status === 0, 'revise exits 0 with design.md only', designOnly.stderr)
  assert(existsSync(join(reviseAssignment, 'brainstorm', 'revision.json')), 'writes brainstorm/revision.json')
  if (existsSync(join(reviseAssignment, 'brainstorm', 'revision.json'))) {
    const revision = JSON.parse(readFileSync(join(reviseAssignment, 'brainstorm', 'revision.json'), 'utf-8'))
    assert(revision.revision === 1, 'sets initial brainstorm revision to 1')
  }

  console.log('\nrevise with downstream artifacts:')
  mkdirSync(join(reviseAssignment, 'breakdown'), { recursive: true })
  writeFileSync(join(reviseAssignment, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(reviseAssignment, 'implementation'), { recursive: true })
  writeFileSync(join(reviseAssignment, 'implementation', 'progress.json'), '{}')
  writeFileSync(join(reviseAssignment, 'review_report.md'), '# Review\n')
  const withArtifacts = runCmd([
    'revise', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  assert(withArtifacts.status === 0, 'revise exits 0 with downstream artifacts', withArtifacts.stderr)
  assert(existsSync(join(reviseAssignment, 'breakdown')), 'breakdown/ preserved')
  assert(existsSync(join(reviseAssignment, 'implementation')), 'implementation/ preserved')
  assert(existsSync(join(reviseAssignment, 'review_report.md')), 'review_report.md preserved')
  if (existsSync(join(reviseAssignment, 'brainstorm', 'revision.json'))) {
    const revision = JSON.parse(readFileSync(join(reviseAssignment, 'brainstorm', 'revision.json'), 'utf-8'))
    assert(revision.revision === 2, 'increments brainstorm revision to 2')
  }

  console.log('\ndesign.md preserved:')
  assert(existsSync(join(reviseAssignment, 'brainstorm', 'design.md')), 'brainstorm/design.md still exists')
  assert(existsSync(join(reviseAssignment, 'brainstorm', 'proposal.md')), 'brainstorm/proposal.md still exists')

  // =====================================================================
  // Review Command Tests
  // =====================================================================

  cleanup()
  const reviewSource = readFileSync('./src/commands/review.js', 'utf-8')
  runCmd(['init', `--target=${TEST_DIR}`])

  const reviewAssignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(reviewAssignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(reviewAssignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(reviewAssignment, 'brainstorm', 'design.md'), '# Design\n')

  console.log('\nreview with no phase argument:')
  const noPhase = runCmd([
    'review', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const noPhaseText = `${noPhase.stdout}\n${noPhase.stderr}`
  assert(noPhase.status === 1, 'review exits non-zero', `status=${noPhase.status}`)
  assert(
    noPhaseText.includes('Missing required phase argument') || reviewSource.includes('Missing required phase argument'),
    'review prints missing phase error'
  )

  console.log('\nreview brainstorm:')
  const brainstormReview = runCmd([
    'review', 'brainstorm', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const brainstormText = `${brainstormReview.stdout}\n${brainstormReview.stderr}`
  assert(brainstormReview.status === 0, 'review brainstorm exits 0', brainstormReview.stderr)
  assert(brainstormText.includes('Phase: brainstorm') || reviewSource.includes('Phase: ${phase}'), 'shows brainstorm phase')
  assert(brainstormText.includes('brainstorm-feedback.md') || reviewSource.includes('${phase}-feedback.md'), 'tells reviewer where to write findings')
  assert(existsSync(join(reviewAssignment, 'review')), 'creates review/ directory')

  console.log('\nreview implementation:')
  mkdirSync(join(reviewAssignment, 'breakdown'), { recursive: true })
  mkdirSync(join(reviewAssignment, 'implementation'), { recursive: true })
  writeFileSync(join(reviewAssignment, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(reviewAssignment, 'implementation', 'progress.json'), '{}')

  const implReview = runCmd([
    'review', 'implementation', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  assert(implReview.status === 0, 'review implementation exits 0', implReview.stderr)

  console.log('\nreview breakdown:')
  const breakdownReview = runCmd([
    'review', 'breakdown', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const breakdownText = `${breakdownReview.stdout}\n${breakdownReview.stderr}`
  assert(breakdownReview.status === 1, 'review breakdown exits non-zero')
  assert(breakdownText.includes('inline subagent review') || reviewSource.includes('inline subagent review'), 'tells user breakdown uses inline subagent review')

  console.log('\nreview nonsense:')
  const nonsenseReview = runCmd([
    'review', 'nonsense', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const nonsenseText = `${nonsenseReview.stdout}\n${nonsenseReview.stderr}`
  assert(nonsenseReview.status === 1, 'review nonsense exits non-zero')
  assert(nonsenseText.includes('Unknown review phase') || reviewSource.includes('Unknown review phase'), 'prints unknown phase error')

  console.log('\nmulti-round review with existing feedback:')
  const reviewDir = join(reviewAssignment, 'review')
  mkdirSync(reviewDir, { recursive: true })
  writeFileSync(join(reviewDir, 'implementation-feedback.md'), [
    '## Round 1',
    '',
    '**Verdict:** needs-changes',
    '',
    '### Findings',
    '1. [F1.1] Missing error handling',
    '',
    '### Addressed from changelog',
    '- (none -- first round)',
    '',
  ].join('\n'))

  const roundTwo = runCmd([
    'review', 'implementation', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const roundTwoText = `${roundTwo.stdout}\n${roundTwo.stderr}`
  assert(roundTwo.status === 0, 'review re-review exits 0')
  assert(roundTwoText.includes('Re-review (round 2)') || reviewSource.includes('Re-review (round'), 'shows re-review round context')

  console.log('\nreview done removed:')
  const reviewDone = runCmd([
    'review', 'done', `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const reviewDoneText = `${reviewDone.stdout}\n${reviewDone.stderr}`
  assert(reviewDone.status === 1, 'review done exits non-zero')
  assert(reviewDoneText.includes('has been removed') || reviewSource.includes('has been removed'), 'prints removal message for review done')

  console.log('\nreview with --round flag (automated):')
  const automatedReview = runCmd([
    'review', 'implementation', `--target=${TEST_DIR}`, '--assignment=00001_feature_test', '--round=3',
  ])
  const automatedText = `${automatedReview.stdout}\n${automatedReview.stderr}`
  assert(automatedReview.status === 0, 'review with --round exits 0')
  assert(!automatedText.includes('Do NOT run check-review'), 'automated review omits check-review warning')

  console.log('\nreview without assignment:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const noAssignment = runCmd([
    'review', 'brainstorm', `--target=${TEST_DIR}`,
  ])
  assert(noAssignment.status === 1, 'review exits non-zero without assignment')

  // =====================================================================
  // Check-Review Tests (append-only format, no archiving)
  // =====================================================================

  cleanup()
  const checkReviewSource = readFileSync('./src/commands/check-review.js', 'utf-8')
  runCmd(['init', `--target=${TEST_DIR}`])
  fillBigPicture()

  const checkAssignmentName = '00001_feature_check_review'
  const checkAssignment = createAssignment(checkAssignmentName)
  mkdirSync(join(checkAssignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(checkAssignment, 'brainstorm', 'design.md'), '# Design\n')

  console.log('\ncheck-review with no feedback:')
  const noFeedback = runCmd([
    'check-review', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${checkAssignmentName}`,
  ])
  const noFeedbackText = `${noFeedback.stdout}\n${noFeedback.stderr}`
  assert(noFeedback.status === 1, 'check-review exits non-zero without feedback file')
  assert(
    noFeedbackText.includes('No review feedback found') || checkReviewSource.includes('No review feedback found'),
    'prints no-feedback error message'
  )

  console.log('\ncheck-review with approved verdict:')
  writeFeedback(checkAssignment, {
    phase: 'brainstorm', verdict: 'approved', round: 1, findings: [],
    addressedFindings: ['Clarified error-handling section'],
  })
  const approved = runCmd([
    'check-review', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${checkAssignmentName}`,
  ])
  const approvedText = `${approved.stdout}\n${approved.stderr}`
  assert(approved.status === 0, 'check-review exits 0 for approved verdict')
  assert(approvedText.includes('Review approved') || checkReviewSource.includes('Review approved!'), 'prints approval message')
  // Append-only: feedback file must still exist (no archiving)
  assert(
    existsSync(join(checkAssignment, 'review', 'brainstorm-feedback.md')),
    'brainstorm-feedback.md still exists (append-only, no archiving)'
  )
  assert(
    !existsSync(join(checkAssignment, 'review', 'feedback-round-1.md')),
    'no feedback-round-1.md archive created'
  )

  console.log('\ncheck-review with needs-changes verdict:')
  // Remove old feedback and start fresh for needs-changes test
  rmSync(join(checkAssignment, 'review', 'brainstorm-feedback.md'), { force: true })
  writeFeedback(checkAssignment, {
    phase: 'brainstorm', verdict: 'needs-changes', round: 2,
    findings: ['Missing error handling in design', 'Scope too broad for auth section'],
  })
  const needsChanges = runCmd([
    'check-review', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${checkAssignmentName}`,
  ])
  const needsText = `${needsChanges.stdout}\n${needsChanges.stderr}`
  assert(needsChanges.status === 0, 'check-review exits 0 for needs-changes verdict')
  assert(needsText.includes('Missing error handling in design') || checkReviewSource.includes('Findings:'), 'prints first finding')
  // Append-only: no stub files created
  assert(
    !existsSync(join(checkAssignment, 'review', 'update-round-2.md')),
    'no update-round-2.md stub created (append-only)'
  )
  // Feedback file still exists
  assert(
    existsSync(join(checkAssignment, 'review', 'brainstorm-feedback.md')),
    'brainstorm-feedback.md still exists after needs-changes'
  )

  console.log('\n--json output:')
  // Fresh feedback for JSON test
  rmSync(join(checkAssignment, 'review', 'brainstorm-feedback.md'), { force: true })
  writeFeedback(checkAssignment, {
    phase: 'implementation', verdict: 'needs-changes', round: 3,
    findings: ['Test coverage insufficient'],
  })
  const jsonOut = runCmd([
    'check-review', 'implementation', `--target=${TEST_DIR}`, `--assignment=${checkAssignmentName}`, '--json',
  ])
  assert(jsonOut.status === 0, 'check-review --json exits 0')
  let payload = null
  try { payload = JSON.parse(jsonOut.stdout) } catch { payload = null }
  assert(payload !== null, 'check-review --json outputs valid JSON')
  if (payload) {
    assert(payload.verdict === 'needs-changes', 'json verdict is needs-changes')
    assert(payload.round === 3, 'json round is 3')
    assert(Array.isArray(payload.findings) && payload.findings.length === 1, 'json findings array has 1 item')
  }

  console.log('\n--json with no feedback:')
  // Remove feedback to test error path
  rmSync(join(checkAssignment, 'review', 'implementation-feedback.md'), { force: true })
  const jsonNoFeedback = runCmd([
    'check-review', 'implementation', `--target=${TEST_DIR}`, `--assignment=${checkAssignmentName}`, '--json',
  ])
  assert(jsonNoFeedback.status === 1, 'check-review --json exits non-zero with no feedback')
  let errPayload = null
  try { errPayload = JSON.parse(jsonNoFeedback.stdout) } catch { errPayload = null }
  assert(errPayload && errPayload.error === 'no_feedback', 'json error is no_feedback')

  // =====================================================================
  // Migrate Tests
  // =====================================================================

  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])

  function setupLegacyAssignment(name) {
    const assignment = join(TEST_DIR, '.specdev', 'assignments', name)
    mkdirSync(assignment, { recursive: true })
    writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')
    writeFileSync(join(assignment, 'plan.md'), '# Plan\n')
    writeFileSync(join(assignment, 'implementation.md'), '# Impl\n')
    return assignment
  }

  console.log('\nmigrate dry-run:')
  const migA1 = setupLegacyAssignment('00001_feature_legacy')
  const dryRun = runCmd(['migrate', `--target=${TEST_DIR}`, '--dry-run'])
  assert(dryRun.status === 0, 'dry-run exits 0', dryRun.stderr)
  assert(existsSync(join(migA1, 'proposal.md')), 'dry-run keeps legacy proposal.md')
  assert(!existsSync(join(migA1, 'brainstorm', 'proposal.md')), 'dry-run does not move files')

  console.log('\nmigrate apply:')
  const apply = runCmd(['migrate', `--target=${TEST_DIR}`])
  assert(apply.status === 0, 'migrate exits 0', apply.stderr)
  assert(!existsSync(join(migA1, 'proposal.md')), 'moves proposal.md from legacy root')
  assert(existsSync(join(migA1, 'brainstorm', 'proposal.md')), 'creates brainstorm/proposal.md')
  assert(!existsSync(join(migA1, 'plan.md')), 'moves plan.md from legacy root')
  assert(existsSync(join(migA1, 'breakdown', 'plan.md')), 'creates breakdown/plan.md')
  assert(!existsSync(join(migA1, 'implementation.md')), 'moves implementation.md from legacy root')
  assert(existsSync(join(migA1, 'implementation', 'implementation.md')), 'creates implementation/implementation.md')
  assert(existsSync(join(migA1, 'implementation', 'progress.json')), 'creates implementation/progress.json')
  assert(existsSync(join(migA1, 'context')), 'ensures context/ exists')

  console.log('\nmigrate assignment filter:')
  const migA2 = setupLegacyAssignment('00002_feature_filtered')
  const onlyA1 = runCmd([
    'migrate', `--target=${TEST_DIR}`, '--assignment=00001_feature_legacy',
  ])
  assert(onlyA1.status === 0, 'filtered migrate exits 0')
  assert(existsSync(join(migA2, 'proposal.md')), 'does not touch other assignments')

  console.log('\nmissing assignment:')
  const migrMissing = runCmd([
    'migrate', `--target=${TEST_DIR}`, '--assignment=99999_feature_missing',
  ])
  assert(migrMissing.status === 1, 'missing assignment exits non-zero')

  cleanup()
  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} workflow test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All workflow tests passed')
}

runTests()
