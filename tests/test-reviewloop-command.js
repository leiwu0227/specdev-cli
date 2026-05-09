import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-command-output')

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
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 30000,
  })
}

function initProject() {
  runCmd(['init', `--target=${TEST_DIR}`])
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
    'utf-8',
  )
}

function createAssignment(name) {
  const root = join(TEST_DIR, '.specdev', 'assignments', name)
  mkdirSync(root, { recursive: true })
  mkdirSync(join(root, 'brainstorm'), { recursive: true })
  writeFileSync(
    join(root, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nA sufficiently long proposal text for validation.',
  )
  writeFileSync(
    join(root, 'brainstorm', 'design.md'),
    '# Design\n\nA sufficiently long design text for validation purposes.',
  )
  return root
}

function setupReviewer(name, config) {
  const dir = join(
    TEST_DIR,
    '.specdev',
    'skills',
    'core',
    'reviewloop',
    'reviewers',
  )
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(config, null, 2))
}

function writeFeedback(assignmentRoot, phase, content) {
  const dir = join(assignmentRoot, 'review')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${phase}-feedback.md`), content, 'utf-8')
}

function writeChangelog(assignmentRoot, phase, content) {
  const dir = join(assignmentRoot, 'review')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${phase}-changelog.md`), content, 'utf-8')
}

const ASSIGNMENT_NAME = '00001_feature_test'

function setCurrent(assignmentName) {
  const currentPath = join(TEST_DIR, '.specdev', '.current')
  writeFileSync(currentPath, assignmentName, 'utf-8')
}

// =====================================================================
// Arg handling tests
// =====================================================================

cleanup()
initProject()
fillBigPicture()

console.log('\nreviewloop (no phase):')
let result = runCmd(['reviewloop', `--target=${TEST_DIR}`])
assert(result.status === 1, 'exits 1 without phase arg')
assert(
  result.stderr.includes('Missing required phase argument'),
  'error mentions missing phase',
)

console.log('\nreviewloop (invalid phase):')
result = runCmd(['reviewloop', 'bogus', `--target=${TEST_DIR}`])
assert(result.status === 1, 'exits 1 for invalid phase')
assert(
  result.stderr.includes('Unknown reviewloop phase'),
  'error mentions unknown phase',
)

// =====================================================================
// Reviewer listing (no --reviewer flag)
// =====================================================================

cleanup()
initProject()
fillBigPicture()
const a1 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)

console.log('\nreviewloop listing (no reviewers):')
// Remove default reviewers
const reviewersDir = join(
  TEST_DIR,
  '.specdev',
  'skills',
  'core',
  'reviewloop',
  'reviewers',
)
if (existsSync(reviewersDir)) rmSync(reviewersDir, { recursive: true, force: true })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

])
assert(result.status === 1, 'exits 1 when no reviewers found')
assert(
  result.stderr.includes('No reviewer configs found'),
  'error mentions no reviewer configs',
)

console.log('\nreviewloop listing (with reviewers):')
setupReviewer('codex', { name: 'codex', command: 'echo hello', max_rounds: 3 })
setupReviewer('local', { name: 'local', command: 'echo hi', max_rounds: 2 })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

])
const listOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 when listing reviewers')
assert(
  listOutput.includes('Available reviewers:'),
  'prints available reviewers header',
)
assert(listOutput.includes('codex'), 'lists codex reviewer')
assert(listOutput.includes('local'), 'lists local reviewer')
assert(
  listOutput.includes('Ask reviewer type as a multiple-choice question:'),
  'prints multiple-choice prompt',
)
assert(
  listOutput.includes('Use one choice per reviewer config; do not ask for free-form reviewer text.'),
  'tells agent not to ask free-form reviewer text',
)
assert(
  listOutput.includes('1. codex'),
  'prints first reviewer as numbered choice',
)
assert(
  listOutput.includes('2. local'),
  'prints second reviewer as numbered choice',
)
assert(
  listOutput.includes('Review, then continue if approved: specdev reviewloop brainstorm --reviewer=<name> --autocontinue'),
  'prints autocontinue command template',
)
assert(
  listOutput.includes('Review only: specdev reviewloop brainstorm --reviewer=<name>'),
  'prints review-only command template',
)

console.log('\nreviewloop listing --json:')
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--json',
])
assert(result.status === 0, 'json listing exits 0 when reviewers exist')
let reviewerListJson = null
try {
  reviewerListJson = JSON.parse(result.stdout)
  assert(true, 'json listing stdout is valid JSON')
} catch {
  assert(false, 'json listing stdout is valid JSON', result.stdout)
}
assert(reviewerListJson?.command === 'reviewloop', 'json listing command is reviewloop')
assert(reviewerListJson?.status === 'ok', 'json listing status is ok')
assert(reviewerListJson?.phase === 'brainstorm', 'json listing includes phase')
assert(reviewerListJson?.reviewers?.includes('codex'), 'json listing includes codex reviewer')

// =====================================================================
// Cursor in default reviewer listing after init
// =====================================================================

console.log('\nreviewloop listing (cursor in defaults after init):')
cleanup()
initProject()
fillBigPicture()
createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

])
const cursorListOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 when listing default reviewers')
assert(cursorListOutput.includes('cursor'), 'cursor appears in default reviewer list')
assert(cursorListOutput.includes('codex'), 'codex still appears in default reviewer list')

// =====================================================================
// Reviewer config validation
// =====================================================================

console.log('\nreviewloop (unknown reviewer):')
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=nonexistent',
])
assert(result.status === 1, 'exits 1 for unknown reviewer')
assert(
  result.stderr.includes('Reviewer config not found'),
  'error mentions config not found',
)

console.log('\nreviewloop (missing command field):')
setupReviewer('no-cmd', { name: 'no-cmd', max_rounds: 3 })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=no-cmd',
])
assert(result.status === 1, 'exits 1 when command field missing')
assert(
  result.stderr.includes("missing required field 'command'"),
  'error mentions missing command field',
)

console.log('\nreviewloop preflight (valid reviewer):')
cleanup()
initProject()
fillBigPicture()
const pfAssignment = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('preflight-ok', {
  name: 'preflight-ok',
  command: 'node --version',
  max_rounds: 3,
  timeout_seconds: 30,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-ok',
  '--preflight',
  '--json',
])
assert(result.status === 0, 'preflight exits 0 for valid reviewer', result.stderr)
let preflight = JSON.parse(result.stdout)
assert(preflight.status === 'pass', 'preflight JSON status is pass')
assert(preflight.reviewers[0].name === 'preflight-ok', 'preflight names reviewer')
assert(preflight.reviewers[0].command.status === 'pass', 'preflight command passes')
assert(preflight.reviewers[0].binary.found === true, 'preflight finds node binary')
assert(!existsSync(join(pfAssignment, 'review', 'brainstorm-feedback.md')), 'preflight does not run reviewer command')

console.log('\nreviewloop preflight (missing command):')
setupReviewer('preflight-missing-command', { name: 'preflight-missing-command' })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-missing-command',
  '--preflight',
  '--json',
])
assert(result.status === 1, 'preflight exits 1 for missing command')
preflight = JSON.parse(result.stdout)
assert(preflight.status === 'fail', 'preflight JSON status is fail')
assert(preflight.reviewers[0].issues.some((i) => i.code === 'missing_command'), 'preflight reports missing_command')

console.log('\nreviewloop preflight blocks normal execution:')
cleanup()
initProject()
fillBigPicture()
const pfBlockAssignment = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('preflight-block', { name: 'preflight-block' })
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=preflight-block',
])
assert(result.status === 1, 'normal reviewloop exits 1 when preflight blocks')
const pfBlockOutput = `${result.stdout}\n${result.stderr}`
assert(pfBlockOutput.includes('Reviewer preflight failed'), 'normal reviewloop prints preflight failure')
assert(!existsSync(join(pfBlockAssignment, 'review', 'brainstorm-feedback.md')), 'blocked preflight does not run reviewer')

// =====================================================================
// Stale feedback guard
// =====================================================================

console.log('\nreviewloop (stale feedback guard):')
cleanup()
initProject()
fillBigPicture()
const a2 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('mock', {
  name: 'mock',
  command: 'echo "mock reviewer"',
  max_rounds: 3,
})
// Write feedback with needs-changes but no matching changelog
writeFeedback(
  a2,
  'brainstorm',
  '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n',
)
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=mock',
])
assert(result.status === 1, 'exits 1 when findings unaddressed')
assert(
  result.stderr.includes(
    'Previous review findings have not been addressed',
  ),
  'error mentions unaddressed findings',
)

console.log('\nreviewloop (stale guard passes with changelog):')
writeChangelog(a2, 'brainstorm', '## Round 1\n\n### Changes\n- Fixed X\n')
// Now it should not hit the stale guard (but will run the reviewer)
// The mock reviewer won't write feedback, so it will fail at the round validation step
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=mock',
])
// Should NOT fail with the stale guard message
const staleOutput = `${result.stdout}\n${result.stderr}`
assert(
  !staleOutput.includes('Previous review findings have not been addressed'),
  'stale guard passes when changelog matches',
)
assert(
  staleOutput.includes('expected ## Round 2'),
  'missing next-round verdict error is explicit',
  staleOutput,
)

// =====================================================================
// Max rounds enforcement
// =====================================================================

console.log('\nreviewloop (max rounds):')
cleanup()
initProject()
fillBigPicture()
const a3 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('mock', {
  name: 'mock',
  command: 'echo "mock reviewer"',
  max_rounds: 2,
})
// Write 2 rounds of feedback (both addressed)
writeFeedback(
  a3,
  'brainstorm',
  [
    '## Round 1',
    '',
    '**Verdict:** needs-changes',
    '',
    '### Findings',
    '1. [F1.1] Fix X',
    '',
    '## Round 2',
    '',
    '**Verdict:** needs-changes',
    '',
    '### Findings',
    '1. [F2.1] Fix Y',
  ].join('\n'),
)
writeChangelog(a3, 'brainstorm', '## Round 1\n\n- Fixed X\n\n## Round 2\n\n- Fixed Y\n')
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=mock',
])
assert(result.status === 1, 'exits 1 when max rounds reached')
assert(
  result.stderr.includes('Max rounds reached'),
  'error mentions max rounds',
)

// =====================================================================
// Mock reviewer: pass verdict with auto-approve
// =====================================================================

console.log('\nreviewloop (pass verdict with mock reviewer):')
cleanup()
initProject()
fillBigPicture()
const a4 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
const reviewDirPath = join(a4, 'review')
mkdirSync(reviewDirPath, { recursive: true })

// Create a mock reviewer that writes an approved round to review-feedback.md
// The reviewer command will be run with cwd=targetDir
const feedbackRelPath = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('pass-mock', {
  name: 'pass-mock',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPath}"`,
  max_rounds: 3,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=pass-mock',
])
const passOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 for approved verdict', result.stderr)
assert(
  passOutput.includes('Review approved'),
  'prints approval message',
  passOutput,
)
assert(
  passOutput.includes("Phase 'brainstorm' has been approved"),
  'prints phase approved',
  passOutput,
)

// Verify status.json was updated
const statusPath = join(a4, 'status.json')
if (existsSync(statusPath)) {
  const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
  assert(
    status.brainstorm_approved === true,
    'status.json has brainstorm_approved=true',
  )
} else {
  assert(false, 'status.json was created by approvePhase')
}

// =====================================================================
// Mock reviewer: needs-changes verdict (not at max rounds)
// =====================================================================

console.log('\nreviewloop (needs-changes verdict):')
cleanup()
initProject()
fillBigPicture()
const a5 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(a5, 'review'), { recursive: true })

const feedbackRelPath2 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('fail-mock', {
  name: 'fail-mock',
  command: `printf '## Round 1\\n\\n**Verdict:** needs-changes\\n\\n### Findings\\n1. [F1.1] Missing tests\\n' >> "${feedbackRelPath2}"`,
  max_rounds: 3,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=fail-mock',
])
const failOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 for needs-changes (not at max)', result.stderr)
assert(
  failOutput.includes('Run specdev check-review to address findings'),
  'prints check-review instruction',
  failOutput,
)

// =====================================================================
// Mock reviewer: needs-changes at max rounds
// =====================================================================

console.log('\nreviewloop (needs-changes at max rounds):')
cleanup()
initProject()
fillBigPicture()
const a6 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(a6, 'review'), { recursive: true })

// Pre-populate with round 1 that was addressed
writeFeedback(
  a6,
  'brainstorm',
  '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n',
)
writeChangelog(a6, 'brainstorm', '## Round 1\n\n- Fixed X\n')

const feedbackRelPath3 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('fail-mock-2', {
  name: 'fail-mock-2',
  command: `printf '\\n## Round 2\\n\\n**Verdict:** needs-changes\\n\\n### Findings\\n1. [F2.1] Still broken\\n' >> "${feedbackRelPath3}"`,
  max_rounds: 2,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=fail-mock-2',
])
const maxOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 for needs-changes at max rounds', result.stderr)
assert(
  maxOutput.includes('Max rounds reached. Escalating to user.'),
  'prints escalation message',
  maxOutput,
)

// =====================================================================
// Mock reviewer: command failure
// =====================================================================

console.log('\nreviewloop (reviewer command failure):')
cleanup()
initProject()
fillBigPicture()
const a7 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('bad-cmd', {
  name: 'bad-cmd',
  command: 'exit 1',
  max_rounds: 3,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=bad-cmd',
])
assert(result.status === 1, 'exits 1 when reviewer command fails')
assert(
  result.stderr.includes('Reviewer exited with code'),
  'error mentions reviewer exit code',
)
assert(
  result.stderr.includes('Reviewer log:'),
  'command failure prints reviewer log path',
)

// =====================================================================
// Mock reviewer: timeout
// =====================================================================

console.log('\nreviewloop (reviewer timeout):')
cleanup()
initProject()
fillBigPicture()
createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
setupReviewer('slow-cmd', {
  name: 'slow-cmd',
  command: 'sleep 5',
  max_rounds: 3,
  timeout_seconds: 0.01,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=slow-cmd',
])
assert(result.status === 1, 'exits 1 when reviewer times out')
assert(
  result.stderr.includes('Reviewer timed out after'),
  'error mentions reviewer timeout',
)
assert(
  result.stderr.includes('Reviewer log:'),
  'timeout prints reviewer log path',
)

// =====================================================================
// Mock reviewer: stdout/stderr log capture
// =====================================================================

console.log('\nreviewloop (reviewer log capture):')
cleanup()
initProject()
fillBigPicture()
const aLog = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aLog, 'review'), { recursive: true })
const feedbackRelLog = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('log-mock', {
  name: 'log-mock',
  command: `echo stdout-line && echo stderr-line >&2 && printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelLog}"`,
  max_rounds: 3,
})
result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=log-mock',
])
assert(result.status === 0, 'exits 0 for log-mock reviewer', result.stderr)
const reviewerLogPath = join(aLog, 'review', 'brainstorm-reviewer-log-mock-round-1.log')
assert(existsSync(reviewerLogPath), 'reviewer log file exists')
if (existsSync(reviewerLogPath)) {
  const reviewerLog = readFileSync(reviewerLogPath, 'utf-8')
  assert(reviewerLog.includes('stdout-line'), 'reviewer log captures stdout')
  assert(reviewerLog.includes('stderr-line'), 'reviewer log captures stderr')
}

// =====================================================================
// Mock reviewer: missing expected round in feedback
// =====================================================================

console.log('\nreviewloop (reviewer writes wrong round):')
cleanup()
initProject()
fillBigPicture()
const a8 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(a8, 'review'), { recursive: true })

const feedbackRelPath4 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
// Reviewer writes round 5 but we expect round 1
setupReviewer('wrong-round', {
  name: 'wrong-round',
  command: `printf '## Round 5\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPath4}"`,
  max_rounds: 3,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=wrong-round',
])
assert(result.status === 1, 'exits 1 when wrong round written')
assert(
  result.stderr.includes('expected ## Round 1') && result.stderr.includes('brainstorm-feedback.md'),
  'error mentions expected round and feedback filename',
)

// =====================================================================
// Environment variables are passed to reviewer
// =====================================================================

console.log('\nreviewloop (env vars passed to reviewer):')
cleanup()
initProject()
fillBigPicture()
const a9 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(a9, 'review'), { recursive: true })

const envLogPath = join(TEST_DIR, 'env-log.txt')
const feedbackRelPath5 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback.md`
setupReviewer('env-check', {
  name: 'env-check',
  command: `echo "PHASE=$SPECDEV_PHASE ASSIGNMENT=$SPECDEV_ASSIGNMENT ROUND=$SPECDEV_ROUND" > "${join(TEST_DIR, 'env-log.txt').replace(/\\/g, '/')}" && printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPath5}"`,
  max_rounds: 3,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,

  '--reviewer=env-check',
])
assert(result.status === 0, 'exits 0 with env-check reviewer', result.stderr)
if (existsSync(envLogPath)) {
  const envLog = readFileSync(envLogPath, 'utf-8').trim()
  assert(
    envLog.includes('PHASE=brainstorm'),
    'SPECDEV_PHASE env var is set',
    envLog,
  )
  assert(
    envLog.includes(`ASSIGNMENT=${ASSIGNMENT_NAME}`),
    'SPECDEV_ASSIGNMENT env var is set',
    envLog,
  )
  assert(envLog.includes('ROUND=1'), 'SPECDEV_ROUND env var is set', envLog)
} else {
  assert(false, 'env-log.txt was written by reviewer command')
}

// =====================================================================
// Implementation phase: pass with auto-approve
// =====================================================================

console.log('\nreviewloop implementation (pass):')
cleanup()
initProject()
fillBigPicture()
const a10 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
// Setup implementation artifacts for approvePhase to succeed
mkdirSync(join(a10, 'implementation'), { recursive: true })
writeFileSync(
  join(a10, 'implementation', 'progress.json'),
  JSON.stringify(
    { tasks: [{ number: 1, status: 'completed' }] },
    null,
    2,
  ),
)
mkdirSync(join(a10, 'review'), { recursive: true })

const feedbackRelPath6 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/implementation-feedback.md`
setupReviewer('impl-pass', {
  name: 'impl-pass',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelPath6}"`,
  max_rounds: 3,
})

result = runCmd([
  'reviewloop',
  'implementation',
  `--target=${TEST_DIR}`,

  '--reviewer=impl-pass',
])
const implOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'exits 0 for implementation pass', result.stderr)
assert(
  implOutput.includes("Phase 'implementation' has been approved"),
  'prints implementation approved',
  implOutput,
)
if (existsSync(join(a10, 'status.json'))) {
  const status = JSON.parse(readFileSync(join(a10, 'status.json'), 'utf-8'))
  assert(
    status.implementation_approved === true,
    'status.json has implementation_approved=true',
  )
} else {
  assert(false, 'status.json created for implementation approval')
}

// =====================================================================
// Multi-reviewer: comma-separated
// =====================================================================

console.log('\nreviewloop multi-reviewer (comma-separated):')
cleanup()
initProject()
fillBigPicture()
const aMulti1 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aMulti1, 'review'), { recursive: true })

const feedbackRelMulti1 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-a.md`
const feedbackRelMulti2 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-b.md`
setupReviewer('pass-a', {
  name: 'pass-a',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelMulti1}"`,
  max_rounds: 5,
})
setupReviewer('pass-b', {
  name: 'pass-b',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelMulti2}"`,
  max_rounds: 5,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-a,pass-b',
])
const multiOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'multi-reviewer exits 0 when all approve', result.stderr)
assert(multiOutput.includes('pass-a'), 'output mentions first reviewer')
assert(multiOutput.includes('pass-b'), 'output mentions second reviewer')
assert(
  multiOutput.includes("Phase 'brainstorm' has been approved"),
  'phase approved after all reviewers pass',
  multiOutput,
)

// Verify separate feedback files exist
const feedbackA = join(aMulti1, 'review', 'brainstorm-feedback-pass-a.md')
const feedbackB = join(aMulti1, 'review', 'brainstorm-feedback-pass-b.md')
assert(existsSync(feedbackA), 'reviewer A feedback file exists')
assert(existsSync(feedbackB), 'reviewer B feedback file exists')

// =====================================================================
// Multi-reviewer: second reviewer needs-changes stops chain
// =====================================================================

console.log('\nreviewloop multi-reviewer (chain stops on needs-changes):')
cleanup()
initProject()
fillBigPicture()
const aMulti2 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
mkdirSync(join(aMulti2, 'review'), { recursive: true })

const feedbackRelStop1 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-pass-c.md`
const feedbackRelStop2 = `.specdev/assignments/${ASSIGNMENT_NAME}/review/brainstorm-feedback-fail-c.md`
setupReviewer('pass-c', {
  name: 'pass-c',
  command: `printf '## Round 1\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelStop1}"`,
  max_rounds: 5,
})
setupReviewer('fail-c', {
  name: 'fail-c',
  command: `printf '## Round 1\\n\\n**Verdict:** needs-changes\\n\\n### Findings\\n1. [F1.1] Fix X\\n' >> "${feedbackRelStop2}"`,
  max_rounds: 5,
})

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-c,fail-c',
])
const stopOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'chain-stop exits 0', result.stderr)
assert(stopOutput.includes('pass-c'), 'first reviewer ran')
assert(stopOutput.includes('fail-c'), 'second reviewer ran')
assert(
  !stopOutput.includes("Phase 'brainstorm' has been approved"),
  'phase NOT approved when second reviewer needs changes',
  stopOutput,
)

// =====================================================================
// Multi-reviewer: skip already-approved reviewer on re-run
// =====================================================================

console.log('\nreviewloop multi-reviewer (skip approved on re-run):')
// Re-run same chain — pass-c should be skipped (already approved)
// fail-c has needs-changes from round 1, so we need a changelog first
const changelogFailC = join(aMulti2, 'review', 'brainstorm-changelog-fail-c.md')
writeFileSync(changelogFailC, '## Round 1\n\n- Fixed X\n')

// Replace fail-c to now approve on round 2
const failCPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'fail-c.json')
const failCApprove = {
  name: 'fail-c',
  command: `printf '\\n## Round 2\\n\\n**Verdict:** approved\\n\\n### Findings\\n- (none)\\n' >> "${feedbackRelStop2}"`,
  max_rounds: 5,
}
writeFileSync(failCPath, JSON.stringify(failCApprove))

result = runCmd([
  'reviewloop',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=pass-c,fail-c',
])
const resumeOutput = `${result.stdout}\n${result.stderr}`
assert(resumeOutput.includes('already approved, skipping'), 'pass-c skipped as already approved')
assert(
  resumeOutput.includes("Phase 'brainstorm' has been approved"),
  'phase approved after resumed reviewer passes',
  resumeOutput,
)

// =====================================================================
// check-review with --reviewer flag (multi-reviewer)
// =====================================================================

console.log('\ncheck-review with --reviewer flag:')
cleanup()
initProject()
fillBigPicture()
const aCheck1 = createAssignment(ASSIGNMENT_NAME)
setCurrent(ASSIGNMENT_NAME)
const checkReviewDir = join(aCheck1, 'review')
mkdirSync(checkReviewDir, { recursive: true })

// Write reviewer-specific feedback file
writeFileSync(
  join(checkReviewDir, 'brainstorm-feedback-test-rev.md'),
  '## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix ABC\n',
)

result = runCmd([
  'check-review',
  'brainstorm',
  `--target=${TEST_DIR}`,
  '--reviewer=test-rev',
])
const checkRevOutput = `${result.stdout}\n${result.stderr}`
assert(result.status === 0, 'check-review with --reviewer exits 0', result.stderr)
assert(checkRevOutput.includes('Fix ABC'), 'shows reviewer-specific findings')

// Test auto-detect: no --reviewer, no default feedback, scan for suffixed files
console.log('\ncheck-review auto-detect multi-reviewer:')
result = runCmd([
  'check-review',
  'brainstorm',
  `--target=${TEST_DIR}`,
])
const autoDetectOutput = `${result.stdout}\n${result.stderr}`
assert(autoDetectOutput.includes('Fix ABC'), 'auto-detect finds reviewer-specific feedback')

// =====================================================================
// checkReviewerCLIs returns cursor-agent binary for cursor config
// =====================================================================

console.log('\ncheckReviewerCLIs (cursor config detection):')
cleanup()
initProject()
fillBigPicture()

const { checkReviewerCLIs } = await import('../src/utils/reviewers.js')
const specdevPath = join(TEST_DIR, '.specdev')
const cliResults = await checkReviewerCLIs(specdevPath)

const cursorResult = cliResults.find(r => r.name === 'cursor')
assert(cursorResult !== undefined, 'checkReviewerCLIs returns cursor entry')
assert(cursorResult.binary === 'cursor-agent', 'cursor entry has binary=cursor-agent')
assert(typeof cursorResult.found === 'boolean', 'cursor entry has boolean found field')

const codexResult = cliResults.find(r => r.name === 'codex')
assert(codexResult !== undefined, 'checkReviewerCLIs still returns codex entry')

// =====================================================================
// Done
// =====================================================================

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
