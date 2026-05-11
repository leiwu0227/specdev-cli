import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-command-output')
const ASSIGNMENT = '00001_feature_test'

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    if (detail) console.error(`       ${detail}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args, env = {}) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, ...env },
  })
}

function initProject() {
  const result = runCmd(['init', `--target=${TEST_DIR}`])
  assert(result.status === 0, 'init succeeds', result.stderr || result.stdout)
}

function fillBigPicture() {
  writeFileSync(
    join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'),
    [
      '# Project Big Picture',
      '',
      '## Overview',
      'A long enough project description to pass placeholder checks.',
      '',
      '## Users / Consumers',
      'Internal users.',
      '',
      '## Tech Stack',
      'Node.js.',
      '',
      '## Architecture',
      'CLI with templates.',
      '',
      '## Conventions & Constraints',
      'No completion claims without evidence.',
      '',
    ].join('\n'),
  )
}

function createAssignment(name = ASSIGNMENT) {
  const root = join(TEST_DIR, '.specdev', 'assignments', name)
  mkdirSync(join(root, 'brainstorm'), { recursive: true })
  writeFileSync(join(root, 'brainstorm', 'proposal.md'), '# Proposal\n\nA valid proposal.\n')
  writeFileSync(join(root, 'brainstorm', 'design.md'), '# Design\n\nA valid design.\n')
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), `${name}\n`)
  return root
}

function setupProject() {
  cleanup()
  initProject()
  fillBigPicture()
  return createAssignment()
}

function reviewerPath(name) {
  return join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', `${name}.json`)
}

function setupReviewer(name, config) {
  const dir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(reviewerPath(name), JSON.stringify({ name, ...config }, null, 2))
}

function feedbackRel(phase, reviewer = null) {
  const suffix = reviewer ? `-${reviewer}` : ''
  return `.specdev/assignments/${ASSIGNMENT}/review/${phase}-feedback${suffix}.md`
}

function writeFeedback(assignmentRoot, phase, content, reviewer = null) {
  const suffix = reviewer ? `-${reviewer}` : ''
  const dir = join(assignmentRoot, 'review')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${phase}-feedback${suffix}.md`), content)
}

function writeChangelog(assignmentRoot, phase, content, reviewer = null) {
  const suffix = reviewer ? `-${reviewer}` : ''
  const dir = join(assignmentRoot, 'review')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${phase}-changelog${suffix}.md`), content)
}

function approvedCommand(path, round = 1) {
  return `printf '## Round ${round}\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${path}"`
}

function needsChangesCommand(path, round = 1) {
  return `printf '## Round ${round}\\n\\n**Verdict:** needs-changes\\n\\n### Findings\\n1. [F${round}.1] Fix this\\n' >> "${path}"`
}

console.log('\nreviewloop argument handling:')
setupProject()
let result = runCmd(['reviewloop', `--target=${TEST_DIR}`])
assert(result.status === 1, 'missing phase exits 1')
assert(result.stderr.includes('Missing required phase argument'), 'missing phase error is clear')
result = runCmd(['reviewloop', 'bogus', `--target=${TEST_DIR}`])
assert(result.status === 1, 'invalid phase exits 1')
assert(result.stderr.includes('Unknown reviewloop phase'), 'invalid phase error is clear')

console.log('\nreviewloop reviewer listing:')
setupProject()
setupReviewer('codex', { command: 'echo ok', max_rounds: 3 })
setupReviewer('local', { command: 'echo ok', max_rounds: 2 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`])
let output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'listing exits 0')
assert(output.includes('Available reviewers:'), 'listing prints header')
assert(output.includes('codex') && output.includes('local'), 'listing prints configured reviewers')
assert(output.includes('--autocontinue'), 'listing prints autocontinue command')
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--json'])
const listing = JSON.parse(result.stdout)
assert(listing.status === 'ok', 'json listing status is ok')
assert(listing.reviewers.includes('codex'), 'json listing includes reviewer')

console.log('\nreviewloop preflight blocks invalid reviewer:')
const preflightAssignment = setupProject()
setupReviewer('missing-command', { max_rounds: 3 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=missing-command', '--preflight', '--json'])
const preflight = JSON.parse(result.stdout)
assert(result.status === 1, 'preflight exits 1 for missing command')
assert(preflight.reviewers[0].issues.some((issue) => issue.code === 'missing_command'), 'preflight reports missing command')
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=missing-command'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 1, 'normal run exits 1 when preflight blocks')
assert(output.includes('Reviewer preflight failed'), 'normal run prints preflight failure')
assert(!existsSync(join(preflightAssignment, 'review', 'brainstorm-feedback.md')), 'blocked preflight does not run reviewer')

console.log('\nreviewloop stale feedback guard:')
const staleAssignment = setupProject()
setupReviewer('mock', { command: 'echo mock', max_rounds: 3 })
writeFeedback(staleAssignment, 'brainstorm', '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n')
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=mock'])
assert(result.status === 1, 'unaddressed findings exit 1')
assert(result.stderr.includes('Previous review findings have not been addressed'), 'stale guard message is clear')
writeChangelog(staleAssignment, 'brainstorm', '## Round 1\n\n- Fixed X\n')
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=mock'])
output = `${result.stdout}\n${result.stderr}`
assert(!output.includes('Previous review findings have not been addressed'), 'changelog bypasses stale guard')
assert(output.includes('expected ## Round 2'), 'next missing round error remains explicit')

console.log('\nreviewloop approved verdict and autocontinue:')
const approvedAssignment = setupProject()
setupReviewer('pass-mock', { command: approvedCommand(feedbackRel('brainstorm')), max_rounds: 3 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=pass-mock', '--autocontinue'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'approved review exits 0', result.stderr)
assert(output.includes("Phase 'brainstorm' has been approved"), 'brainstorm gate is approved')
assert(output.includes('Autocontinue requested'), 'autocontinue section is printed')
assert(output.includes('"mode": "autocontinue"'), 'autocontinue contract is printed')
const approvedStatus = JSON.parse(readFileSync(join(approvedAssignment, 'status.json'), 'utf-8'))
assert(approvedStatus.brainstorm_approved === true, 'status marks brainstorm approved')

console.log('\nreviewloop needs-changes verdict:')
setupProject()
setupReviewer('needs-work', { command: needsChangesCommand(feedbackRel('brainstorm')), max_rounds: 3 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=needs-work'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'needs-changes exits 0 before max rounds')
assert(output.includes('Run specdev check-review to address findings'), 'needs-changes prints check-review instruction')

console.log('\nreviewloop timeout and log capture:')
const timeoutAssignment = setupProject()
setupReviewer('slow', { command: 'sleep 5', max_rounds: 3, timeout_seconds: 30 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=slow'], { SPECDEV_REVIEWER_TIMEOUT: '1' })
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 1, 'timeout exits 1')
assert(output.includes('Reviewer timed out after 1s'), 'timeout uses env override')
const timeoutLog = join(timeoutAssignment, 'review', 'brainstorm-reviewer-slow-round-1.log')
assert(existsSync(timeoutLog), 'timeout log is written')
if (existsSync(timeoutLog)) {
  assert(readFileSync(timeoutLog, 'utf-8').includes('Timed out:  true'), 'timeout log records timeout')
}

console.log('\nreviewloop reviewer log capture:')
const logAssignment = setupProject()
setupReviewer('log-mock', {
  command: `echo stdout-line && echo stderr-line >&2 && ${approvedCommand(feedbackRel('brainstorm'))}`,
  max_rounds: 3,
})
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=log-mock'])
assert(result.status === 0, 'log mock exits 0', result.stderr)
const logPath = join(logAssignment, 'review', 'brainstorm-reviewer-log-mock-round-1.log')
assert(result.stdout.includes(`Reviewer log: ${logPath}`), 'reviewer log path is printed')
const logText = existsSync(logPath) ? readFileSync(logPath, 'utf-8') : ''
assert(logText.includes('stdout-line'), 'reviewer log captures stdout')
assert(logText.includes('stderr-line'), 'reviewer log captures stderr')
assert(logText.includes('Verdict:    approved'), 'reviewer log records verdict')

console.log('\nreviewloop stdout salvage:')
const salvageAssignment = setupProject()
setupReviewer('salvage', {
  command: "printf 'preface\\n## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n'",
  max_rounds: 3,
})
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=salvage'])
assert(result.status === 0, 'stdout feedback is salvaged', result.stderr)
const salvageFeedback = join(salvageAssignment, 'review', 'brainstorm-feedback.md')
const salvageText = existsSync(salvageFeedback) ? readFileSync(salvageFeedback, 'utf-8') : ''
assert(salvageText.includes('salvaged from stdout'), 'salvage marker is written')
assert(salvageText.includes('## Round 1'), 'salvaged feedback contains round')

console.log('\nreviewloop implementation approval:')
const implementationAssignment = setupProject()
mkdirSync(join(implementationAssignment, 'implementation'), { recursive: true })
writeFileSync(join(implementationAssignment, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }))
setupReviewer('impl-pass', { command: approvedCommand(feedbackRel('implementation')), max_rounds: 3 })
result = runCmd(['reviewloop', 'implementation', `--target=${TEST_DIR}`, '--reviewer=impl-pass'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'implementation approved review exits 0', result.stderr)
assert(output.includes("Phase 'implementation' has been approved"), 'implementation gate is approved')
const implementationStatus = JSON.parse(readFileSync(join(implementationAssignment, 'status.json'), 'utf-8'))
assert(implementationStatus.implementation_approved === true, 'status marks implementation approved')

console.log('\nreviewloop multi-reviewer stop and resume:')
const multiAssignment = setupProject()
setupReviewer('pass-a', { command: approvedCommand(feedbackRel('brainstorm', 'pass-a')), max_rounds: 5 })
setupReviewer('fail-b', { command: needsChangesCommand(feedbackRel('brainstorm', 'fail-b')), max_rounds: 5 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=pass-a,fail-b'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'multi-reviewer needs-changes exits 0')
assert(output.includes('pass-a') && output.includes('fail-b'), 'both reviewers run')
assert(!output.includes("Phase 'brainstorm' has been approved"), 'phase is not approved when second reviewer fails')
writeChangelog(multiAssignment, 'brainstorm', '## Round 1\n\n- Fixed issue\n', 'fail-b')
setupReviewer('fail-b', { command: approvedCommand(feedbackRel('brainstorm', 'fail-b'), 2), max_rounds: 5 })
result = runCmd(['reviewloop', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=pass-a,fail-b'])
output = `${result.stdout}\n${result.stderr}`
assert(output.includes('already approved, skipping'), 'already approved reviewer is skipped')
assert(output.includes("Phase 'brainstorm' has been approved"), 'phase is approved after resumed reviewer passes')

console.log('\ncheck-review reviewer selection:')
const checkAssignment = setupProject()
writeFeedback(checkAssignment, 'brainstorm', '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix ABC\n', 'test-rev')
result = runCmd(['check-review', 'brainstorm', `--target=${TEST_DIR}`, '--reviewer=test-rev'])
output = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'check-review with reviewer exits 0')
assert(output.includes('Fix ABC'), 'check-review reads reviewer-specific feedback')
result = runCmd(['check-review', 'brainstorm', `--target=${TEST_DIR}`])
output = `${result.stdout}\n${result.stderr}`
assert(output.includes('Fix ABC'), 'check-review auto-detects reviewer-specific feedback')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
