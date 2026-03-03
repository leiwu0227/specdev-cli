import { writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'
import { assignmentCommand } from '../src/commands/assignment.js'
import {
  parseAssignmentId,
  assignmentName,
  resolveAssignmentSelector,
} from '../src/utils/assignment.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCHEMA_SCRIPT = join(__dirname, '..', 'scripts', 'verify-assignment-schema.js')
const TEST_DIR = './test-assignment-output'
const SCHEMA_TEST_DIR = join(__dirname, 'test-assignment-schema-output')

let failures = 0
let passes = 0

function cleanup() {
  cleanupDir(TEST_DIR)
}

function runCmd(args) {
  return runSpecdev(args)
}

async function runAssignmentDirect(args, flags = {}) {
  const stdout = []
  const stderr = []
  const origLog = console.log
  const origErr = console.error
  const prevExitCode = process.exitCode
  process.exitCode = undefined
  console.log = (...parts) => stdout.push(parts.join(' '))
  console.error = (...parts) => stderr.push(parts.join(' '))
  try {
    await assignmentCommand(args, flags)
    return {
      status: process.exitCode ?? 0,
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
    }
  } finally {
    console.log = origLog
    console.error = origErr
    process.exitCode = prevExitCode
  }
}

function assert(condition, msg, detail = '') {
  if (!assertTest(condition, msg, detail)) failures++
  else passes++
}

function schemaCleanup() {
  if (existsSync(SCHEMA_TEST_DIR)) rmSync(SCHEMA_TEST_DIR, { recursive: true, force: true })
}

function runSchemaCheck(path) {
  return spawnSync('node', [SCHEMA_SCRIPT, path], { encoding: 'utf-8' })
}

async function runTests() {
  cleanup()

  // Setup
  const init = runCmd(['init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')

  // =====================================================================
  // Assignment Command Tests
  // =====================================================================

  console.log('assignment reserves ID without creating folder:')
  const result = await runAssignmentDirect(['Add', 'auth', 'system'], { target: TEST_DIR })
  assert(result.status === 0, 'exits 0', result.stderr)
  assert(result.stdout.includes('00001'), 'outputs ID 00001')
  assert(result.stdout.includes('Add auth system'), 'outputs description')

  const assignmentsDir = join(TEST_DIR, '.specdev/assignments')
  const entries = existsSync(assignmentsDir) ? readdirSync(assignmentsDir).filter(e => !e.startsWith('.')) : []
  assert(entries.length === 0, 'does NOT create assignment folder', `found: ${entries.join(', ')}`)

  console.log('\nassignment increments ID:')
  const fse = await import('fs-extra')
  await fse.default.ensureDir(join(assignmentsDir, '00001_feature_auth-system'))
  const result2 = await runAssignmentDirect(['Add payment flow'], { target: TEST_DIR })
  assert(result2.status === 0, 'second assignment exits 0')
  assert(result2.stdout.includes('00002'), 'second assignment gets ID 00002')

  console.log('\nassignment without big_picture:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const noBigPicture = await runAssignmentDirect(['test feature'], { target: TEST_DIR })
  assert(noBigPicture.status === 1, 'exits non-zero without big_picture filled')

  console.log('\nassignment numeric label disambiguation:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')
  await fse.default.ensureDir(join(TEST_DIR, '.specdev/assignments/00001_feature_auth-system'))
  const numericLabel = await runAssignmentDirect(['1'], { target: TEST_DIR })
  assert(numericLabel.status === 1, 'exits non-zero in non-interactive mode for numeric label')

  console.log('\nassignment without description:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')
  const noDesc = await runAssignmentDirect([], { target: TEST_DIR })
  assert(noDesc.status === 1, 'exits non-zero without description')
  assert(noDesc.stderr.includes('No description'), 'prints usage hint')

  console.log('\nassignment --json output:')
  const jsonResult = await runAssignmentDirect(['Add dark mode'], { target: TEST_DIR, json: true })
  assert(jsonResult.status === 0, 'exits 0 with --json')
  let parsed
  try {
    parsed = JSON.parse(jsonResult.stdout)
  } catch {
    parsed = null
  }
  assert(parsed !== null, 'outputs valid JSON', jsonResult.stdout)
  if (parsed) {
    assert(parsed.id === '00001', 'JSON has correct id')
    assert(parsed.description === 'Add dark mode', 'JSON has correct description')
    assert(parsed.status === 'ok', 'JSON has status ok')
    assert(parsed.version === 1, 'JSON has version 1')
    assert(typeof parsed.assignments_dir === 'string', 'JSON has assignments_dir')
  }

  // =====================================================================
  // Assignment Schema Tests
  // =====================================================================

  schemaCleanup()
  mkdirSync(SCHEMA_TEST_DIR, { recursive: true })

  function setupValidReviewPhase() {
    const assignment = join(SCHEMA_TEST_DIR, '00001_feature_auth')
    mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
    mkdirSync(join(assignment, 'breakdown'), { recursive: true })
    mkdirSync(join(assignment, 'implementation'), { recursive: true })
    mkdirSync(join(assignment, 'context'), { recursive: true })
    writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
    writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
    writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}\n')
    writeFileSync(join(assignment, 'review_report.md'), '# Review Report\n')
    return assignment
  }

  function setupPartialBrainstormPhase() {
    const assignment = join(SCHEMA_TEST_DIR, '00002_feature_partial')
    mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
    mkdirSync(join(assignment, 'context'), { recursive: true })
    writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
    return assignment
  }

  function setupInvalidMissingContext() {
    const assignment = join(SCHEMA_TEST_DIR, '00003_feature_invalid')
    mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
    return assignment
  }

  console.log('\nvalid review-phase assignment:')
  let assignmentPath = setupValidReviewPhase()
  let schemaResult = runSchemaCheck(assignmentPath)
  assert(schemaResult.status === 0, 'schema check exits 0 for valid review-phase structure')
  assert(schemaResult.stdout.includes('Schema checks passed'), 'reports schema checks passed')

  console.log('\npartial brainstorm assignment:')
  assignmentPath = setupPartialBrainstormPhase()
  schemaResult = runSchemaCheck(assignmentPath)
  assert(schemaResult.status === 0, 'schema check exits 0 for valid early-phase structure')
  assert(schemaResult.stdout.includes('brainstorm artifacts satisfy "any" rule'), 'accepts brainstorm any-rule')

  console.log('\ninvalid assignment (missing required dir):')
  assignmentPath = setupInvalidMissingContext()
  schemaResult = runSchemaCheck(assignmentPath)
  assert(schemaResult.status !== 0, 'schema check exits non-zero when required directory is missing')
  assert(schemaResult.stdout.includes('context/ missing'), 'reports missing required context directory')

  schemaCleanup()

  // =====================================================================
  // Assignment Utils Tests
  // =====================================================================

  console.log('\nparseAssignmentId — standard format:')
  const parsed1 = parseAssignmentId('00001_feature_auth')
  assert(parsed1.id === '00001', 'parses id')
  assert(parsed1.type === 'feature', 'parses type')
  assert(parsed1.label === 'auth', 'parses label')

  console.log('\nparseAssignmentId — compound labels:')
  const parsed2 = parseAssignmentId('00002_bugfix_login-page')
  assert(parsed2.id === '00002', 'parses compound id')
  assert(parsed2.type === 'bugfix', 'parses compound type')
  assert(parsed2.label === 'login-page', 'parses compound label')

  console.log('\nparseAssignmentId — non-standard names:')
  const parsed3 = parseAssignmentId('random-folder')
  assert(parsed3.id === null, 'returns null id for non-standard')
  assert(parsed3.type === null, 'returns null type for non-standard')
  assert(parsed3.label === 'random-folder', 'returns full name as label')

  console.log('\nassignmentName — extracts dir name:')
  assert(assignmentName('/foo/bar/00001_feature_auth') === '00001_feature_auth', 'unix path')
  assert(assignmentName('C:\\foo\\bar\\00001_feature_auth') === '00001_feature_auth', 'windows path')

  console.log('\nresolveAssignmentSelector — explicit name:')
  const tmpRoot1 = join(tmpdir(), `specdev-assignment-test-${Date.now()}-1`)
  try {
    const specdevPath = join(tmpRoot1, '.specdev')
    const assignmentsPath = join(specdevPath, 'assignments')
    mkdirSync(join(assignmentsPath, '00001_feature_auth'), { recursive: true })

    const resolved = await resolveAssignmentSelector(specdevPath, '00001_feature_auth')
    assert(resolved !== null && resolved !== undefined, 'resolves explicit name')
    if (resolved) {
      assert(resolved.name === '00001_feature_auth', 'resolved name matches')
      assert(resolved.path === join(assignmentsPath, '00001_feature_auth'), 'resolved path matches')
    }
  } finally {
    rmSync(tmpRoot1, { recursive: true, force: true })
  }

  console.log('\nresolveAssignmentSelector — numeric shorthand:')
  const tmpRoot2 = join(tmpdir(), `specdev-assignment-test-${Date.now()}-2`)
  try {
    const specdevPath = join(tmpRoot2, '.specdev')
    const assignmentsPath = join(specdevPath, 'assignments')
    mkdirSync(join(assignmentsPath, '00001_feature_auth'), { recursive: true })

    const resolved = await resolveAssignmentSelector(specdevPath, '1')
    assert(resolved !== null && resolved !== undefined, 'resolves numeric shorthand')
    if (resolved) {
      assert(resolved.name === '00001_feature_auth', 'numeric resolved name matches')
      assert(resolved.path === join(assignmentsPath, '00001_feature_auth'), 'numeric resolved path matches')
    }
  } finally {
    rmSync(tmpRoot2, { recursive: true, force: true })
  }

  console.log('\nresolveAssignmentSelector — ambiguous numeric:')
  const tmpRoot3 = join(tmpdir(), `specdev-assignment-test-${Date.now()}-3`)
  try {
    const specdevPath = join(tmpRoot3, '.specdev')
    const assignmentsPath = join(specdevPath, 'assignments')
    mkdirSync(join(assignmentsPath, '001_feature_auth'), { recursive: true })
    mkdirSync(join(assignmentsPath, '0001_bugfix_login'), { recursive: true })

    const resolved = await resolveAssignmentSelector(specdevPath, '1')
    assert(resolved !== null && resolved !== undefined, 'returns result for ambiguous numeric')
    if (resolved) {
      assert(resolved.ambiguous === true, 'reports ambiguous')
      const matchSet = new Set(resolved.matches)
      assert(matchSet.has('001_feature_auth') && matchSet.has('0001_bugfix_login'), 'includes both matches')
    }
  } finally {
    rmSync(tmpRoot3, { recursive: true, force: true })
  }

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} assignment test(s) failed`); process.exit(1) }
  console.log('✅ All assignment tests passed')
}

runTests()
