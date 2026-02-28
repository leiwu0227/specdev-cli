import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const TEST_DIR = './test-continue-output'

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
    return false
  }
  console.log(`  ✓ ${msg}`)
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
      'A long enough project description to pass placeholder checks.',
      '',
      '## Users / Consumers',
      'Internal users and external users.',
      '',
      '## Tech Stack',
      'TypeScript, Node.js, tests, and shell scripts.',
      '',
      '## Architecture',
      'CLI and templates with markdown artifacts.',
      '',
      '## Conventions & Constraints',
      'No completion claims without evidence.',
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

function writeGateStatus(assignmentRoot, gates) {
  writeFileSync(join(assignmentRoot, 'status.json'), JSON.stringify(gates, null, 2) + '\n', 'utf-8')
}

function continueJson(assignment) {
  const args = ['continue', `--target=${TEST_DIR}`, '--json']
  if (assignment) {
    args.push(`--assignment=${assignment}`)
  }
  const result = runCmd(args)
  let payload = null
  if (result.stdout.trim()) {
    try {
      payload = JSON.parse(result.stdout)
    } catch {
      payload = null
    }
  }
  return { result, payload }
}

async function runTests() {
  let failures = 0
  cleanup()

  // project_context_missing
  runCmd(['init', `--target=${TEST_DIR}`])
  console.log('project_context_missing:')
  let out = continueJson()
  if (!assert(out.result.status === 1, 'exits non-zero when big_picture is missing')) failures++
  if (!assert(out.payload && out.payload.state === 'project_context_missing', 'reports project_context_missing state')) failures++

  // no_assignment
  console.log('\nno_assignment:')
  fillBigPicture()
  out = continueJson()
  if (!assert(out.result.status === 1, 'exits non-zero when no assignment exists')) failures++
  if (!assert(out.payload && out.payload.state === 'no_assignment', 'reports no_assignment state')) failures++

  // brainstorm_in_progress
  console.log('\nbrainstorm_in_progress:')
  const a1 = createAssignment('00001_feature_brainstorm')
  mkdirSync(join(a1, 'brainstorm'), { recursive: true })
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.result.status === 0, 'continue runs for brainstorm state')) failures++
  if (!assert(out.payload && out.payload.state === 'brainstorm_in_progress', 'detects brainstorm_in_progress')) failures++

  // brainstorm_checkpoint_ready (both proposal + design exist, gate not yet approved)
  console.log('\nbrainstorm_checkpoint_ready:')
  writeFileSync(join(a1, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(a1, 'brainstorm', 'design.md'), '# Design\n')
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'brainstorm_checkpoint_ready', 'detects brainstorm_checkpoint_ready')) failures++

  // breakdown_in_progress (brainstorm approved, no plan yet)
  console.log('\nbreakdown_in_progress:')
  writeGateStatus(a1, { brainstorm_approved: true })
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'breakdown_in_progress', 'detects breakdown_in_progress')) failures++

  // implementation_in_progress (plan exists, tasks not all done)
  console.log('\nimplementation_in_progress:')
  mkdirSync(join(a1, 'breakdown'), { recursive: true })
  writeFileSync(join(a1, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(a1, 'implementation'), { recursive: true })
  writeFileSync(
    join(a1, 'implementation', 'progress.json'),
    JSON.stringify(
      {
        tasks: [
          { number: 1, status: 'completed' },
          { number: 2, status: 'in_progress' },
          { number: 3, status: 'pending' },
        ],
      },
      null,
      2
    ) + '\n'
  )
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'implementation_in_progress', 'detects implementation_in_progress')) failures++
  if (!assert(out.payload && out.payload.progress && out.payload.progress.totalTasks === 3, 'parses total task count from progress.json')) failures++

  // review feedback surfaced
  console.log('\nreview feedback surfaced:')
  mkdirSync(join(a1, 'review'), { recursive: true })
  writeFileSync(join(a1, 'review', 'review-feedback.md'), '# Review Feedback\n\n**Verdict:** needs-changes\n')
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.review_feedback === 'review/review-feedback.md', 'surfaces review_feedback path')) failures++

  // implementation_checkpoint_ready (all tasks complete, gate not approved)
  console.log('\nimplementation_checkpoint_ready:')
  rmSync(join(a1, 'review', 'review-feedback.md'))
  writeFileSync(
    join(a1, 'implementation', 'progress.json'),
    JSON.stringify(
      {
        tasks: [
          { number: 1, status: 'completed' },
          { number: 2, status: 'completed' },
        ],
      },
      null,
      2
    ) + '\n'
  )
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'implementation_checkpoint_ready', 'detects implementation_checkpoint_ready')) failures++

  // summary_in_progress (implementation approved, no capture diffs)
  console.log('\nsummary_in_progress:')
  writeGateStatus(a1, { brainstorm_approved: true, implementation_approved: true })
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'summary_in_progress', 'detects summary_in_progress')) failures++

  // completed (capture diffs exist)
  console.log('\ncompleted:')
  mkdirSync(join(a1, 'capture'), { recursive: true })
  writeFileSync(join(a1, 'capture', 'project-notes-diff.md'), '# Project Notes Diff\n')
  writeFileSync(join(a1, 'capture', 'workflow-diff.md'), '# Workflow Diff\n')
  out = continueJson('00001_feature_brainstorm')
  if (!assert(out.payload && out.payload.state === 'completed', 'detects completed')) failures++

  // numeric assignment shorthand
  console.log('\nnumeric assignment shorthand:')
  out = continueJson('1')
  if (!assert(out.result.status === 0, 'accepts numeric --assignment selector')) failures++
  if (!assert(out.payload && out.payload.assignment === '00001_feature_brainstorm', 'resolves numeric selector to assignment name')) failures++

  // ambiguous numeric assignment shorthand
  console.log('\nambiguous numeric assignment shorthand:')
  const a1Alt = createAssignment('001_feature_brainstorm-alt')
  mkdirSync(join(a1Alt, 'brainstorm'), { recursive: true })
  out = continueJson('1')
  if (!assert(out.result.status === 1, 'fails when numeric selector is ambiguous')) failures++
  if (!assert(out.payload && out.payload.state === 'assignment_ambiguous', 'reports assignment_ambiguous for numeric selector')) failures++

  // legacy layout blocker
  console.log('\nlegacy layout blocker:')
  const a2 = createAssignment('00002_feature_legacy')
  mkdirSync(join(a2, 'brainstorm'), { recursive: true })
  writeFileSync(join(a2, 'proposal.md'), '# Legacy proposal\n')
  out = continueJson('00002_feature_legacy')
  if (!assert(out.payload && out.payload.blockers.some((b) => b.code === 'legacy_layout_detected'), 'reports legacy_layout_detected blocker')) failures++

  // design revision mismatch blocker
  console.log('\ndesign revision mismatch blocker:')
  const a3 = createAssignment('00003_feature_revised')
  mkdirSync(join(a3, 'brainstorm'), { recursive: true })
  mkdirSync(join(a3, 'breakdown'), { recursive: true })
  writeFileSync(join(a3, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(a3, 'brainstorm', 'design.md'), '# Design\n')
  writeFileSync(join(a3, 'breakdown', 'plan.md'), '# Plan\n')
  writeGateStatus(a3, { brainstorm_approved: true })
  writeFileSync(
    join(a3, 'brainstorm', 'revision.json'),
    JSON.stringify({ version: 1, revision: 2, timestamp: new Date().toISOString() }, null, 2) + '\n'
  )
  writeFileSync(
    join(a3, 'breakdown', 'metadata.json'),
    JSON.stringify({ version: 1, based_on_brainstorm_revision: 1, timestamp: new Date().toISOString() }, null, 2) + '\n'
  )
  out = continueJson('00003_feature_revised')
  if (!assert(out.result.status === 1, 'exits non-zero when design and breakdown revisions mismatch')) failures++
  if (!assert(out.payload && out.payload.state === 'revision_requires_rebreakdown', 'detects revision_requires_rebreakdown state')) failures++
  if (!assert(out.payload && out.payload.blockers.some((b) => b.code === 'design_revision_mismatch'), 'reports design_revision_mismatch blocker')) failures++

  // ambiguous auto-selection requires clarification when assignments tie
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
  if (!assert(out.result.status === 1, 'exits non-zero when active assignment is ambiguous')) failures++
  if (!assert(out.payload && out.payload.state === 'assignment_ambiguous', 'reports assignment_ambiguous state')) failures++
  if (!assert(out.payload && Array.isArray(out.payload.candidates) && out.payload.candidates.length >= 2, 'includes candidate assignments for disambiguation')) failures++

  cleanup()
  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} continue test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All continue tests passed')
}

runTests()
