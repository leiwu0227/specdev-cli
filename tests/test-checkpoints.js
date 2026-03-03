import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockToolSkill } from './helpers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-checkpoints-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const stdoutPath = join(TEST_DIR, `.tmp-${token}.stdout`)
  const stderrPath = join(TEST_DIR, `.tmp-${token}.stderr`)
  const outFd = openSync(stdoutPath, 'w')
  const errFd = openSync(stderrPath, 'w')
  const result = spawnSync('node', [CLI, ...args], { stdio: ['ignore', outFd, errFd] })
  closeSync(outFd)
  closeSync(errFd)
  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, 'utf-8') : ''
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf-8') : ''
  rmSync(stdoutPath, { force: true })
  rmSync(stderrPath, { force: true })
  return { ...result, stdout, stderr }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

// =====================================================================
// Brainstorm Checkpoint
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

console.log('\nbrainstorm checkpoint — feature with all sections:')
const featureDir = join(TEST_DIR, '.specdev', 'assignments', '001_feature_auth')
mkdirSync(join(featureDir, 'brainstorm'), { recursive: true })

writeFileSync(join(featureDir, 'brainstorm', 'proposal.md'), 'Add JWT authentication to the API endpoints.')
writeFileSync(join(featureDir, 'brainstorm', 'design.md'), `## Overview\nAdd JWT auth to protect API endpoints.\n\n## Goals\nSecure all API endpoints with token-based auth.\n\n## Non-Goals\nNo OAuth or social login in v1.\n\n## Design\nMiddleware validates JWT on each request.\n\n## Success Criteria\nAll protected endpoints return 401 without valid token.\n`)

let result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${featureDir}`])
assert(result.status === 0, 'feature with all required sections passes')

console.log('\nbrainstorm checkpoint — feature missing Non-Goals:')
const featureDir2 = join(TEST_DIR, '.specdev', 'assignments', '002_feature_search')
mkdirSync(join(featureDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(featureDir2, 'brainstorm', 'proposal.md'), 'Add full-text search to the app.')
writeFileSync(join(featureDir2, 'brainstorm', 'design.md'), `## Overview\nAdd search functionality.\n\n## Goals\nUsers can search content.\n\n## Design\nUse elasticsearch index.\n\n## Success Criteria\nSearch returns results within 200ms.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${featureDir2}`])
assert(result.status === 1, 'feature missing Non-Goals fails')

console.log('\nbrainstorm checkpoint — bugfix with all sections:')
const bugfixDir = join(TEST_DIR, '.specdev', 'assignments', '003_bugfix_crash')
mkdirSync(join(bugfixDir, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir, 'brainstorm', 'proposal.md'), 'Fix null pointer crash on empty input.')
writeFileSync(join(bugfixDir, 'brainstorm', 'design.md'), `## Overview\nApp crashes when input is empty.\n\n## Root Cause\nMissing null check in parser.\n\n## Fix Design\nAdd guard clause before parsing.\n\n## Success Criteria\nEmpty input returns empty result without crash.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${bugfixDir}`])
assert(result.status === 0, 'bugfix with all required sections passes')

console.log('\nbrainstorm checkpoint — bugfix missing Root Cause:')
const bugfixDir2 = join(TEST_DIR, '.specdev', 'assignments', '004_bugfix_timeout')
mkdirSync(join(bugfixDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir2, 'brainstorm', 'proposal.md'), 'Fix timeout on large uploads.')
writeFileSync(join(bugfixDir2, 'brainstorm', 'design.md'), `## Overview\nLarge uploads time out.\n\n## Fix Design\nIncrease timeout and add chunking.\n\n## Success Criteria\nUploads up to 100MB complete successfully.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${bugfixDir2}`])
assert(result.status === 1, 'bugfix missing Root Cause fails')

console.log('\nbrainstorm checkpoint — familiarization with Overview:')
const famDir = join(TEST_DIR, '.specdev', 'assignments', '005_familiarization_codebase')
mkdirSync(join(famDir, 'brainstorm'), { recursive: true })

writeFileSync(join(famDir, 'brainstorm', 'proposal.md'), 'Understand the authentication module.')
writeFileSync(join(famDir, 'brainstorm', 'design.md'), `## Overview\nExplore the auth module to understand token flow and middleware chain.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${famDir}`])
assert(result.status === 0, 'familiarization with Overview only passes')

console.log('\nbrainstorm checkpoint — refactor with all sections:')
const refactorDir = join(TEST_DIR, '.specdev', 'assignments', '006_refactor_db-layer')
mkdirSync(join(refactorDir, 'brainstorm'), { recursive: true })

writeFileSync(join(refactorDir, 'brainstorm', 'proposal.md'), 'Refactor database layer to use connection pooling.')
writeFileSync(join(refactorDir, 'brainstorm', 'design.md'), `## Overview\nReplace individual connections with a connection pool.\n\n## Non-Goals\nNo schema changes or migrations in this refactor.\n\n## Design\nIntroduce a pool manager that wraps pg.Pool.\n\n## Success Criteria\nAll existing tests pass. Connection count drops under load.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${refactorDir}`])
assert(result.status === 0, 'refactor with all required sections passes')

console.log('\nbrainstorm checkpoint — unknown type falls back to feature:')
const unknownDir = join(TEST_DIR, '.specdev', 'assignments', '007_unknown_thing')
mkdirSync(join(unknownDir, 'brainstorm'), { recursive: true })

writeFileSync(join(unknownDir, 'brainstorm', 'proposal.md'), 'Do something with an unknown type assignment.')
writeFileSync(join(unknownDir, 'brainstorm', 'design.md'), `## Overview\nAn unknown type assignment.\n\n## Goals\nTest fallback behavior.\n\n## Non-Goals\nNothing excluded.\n\n## Design\nSimple implementation.\n\n## Success Criteria\nIt works.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${unknownDir}`])
assert(result.status === 0, 'unknown type with feature sections passes')

console.log('\nbrainstorm checkpoint — strict heading matching:')
const strictDir = join(TEST_DIR, '.specdev', 'assignments', '009_feature_strict-headings')
mkdirSync(join(strictDir, 'brainstorm'), { recursive: true })

writeFileSync(join(strictDir, 'brainstorm', 'proposal.md'), 'Validate strict heading matching for required sections.')
writeFileSync(join(strictDir, 'brainstorm', 'design.md'), `## Overviewing\nWrong heading variant.\n\n## Goals and Scope\nWrong heading variant.\n\n## Non-Goals-ish\nWrong heading variant.\n\n## Design Draft\nWrong heading variant.\n\n## Success Criteria Maybe\nWrong heading variant.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${strictDir}`])
assert(result.status === 1, 'feature with suffix headings fails strict section matching')

console.log('\nbrainstorm checkpoint — missing proposal.md still fails:')
const noProposalDir = join(TEST_DIR, '.specdev', 'assignments', '008_feature_noproposal')
mkdirSync(join(noProposalDir, 'brainstorm'), { recursive: true })

writeFileSync(join(noProposalDir, 'brainstorm', 'design.md'), `## Overview\nHas design but no proposal.\n\n## Goals\nTest.\n\n## Non-Goals\nNone.\n\n## Design\nSimple.\n\n## Success Criteria\nWorks.\n`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${noProposalDir}`])
assert(result.status === 1, 'missing proposal.md still fails')

// =====================================================================
// Implementation Checkpoint (Tool Skills)
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
createMockToolSkill(TEST_DIR, 'mock-tool')

runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])

const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', '001_feature_test')
mkdirSync(join(assignmentDir, 'implementation'), { recursive: true })
mkdirSync(join(assignmentDir, 'breakdown'), { recursive: true })

writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), `# Test Plan

### Task 1: Research API
**Skills:** [mock-tool, test-driven-development]

Do research.

### Task 2: Implement
**Skills:** [test-driven-development]

Build it.
`)

writeFileSync(join(assignmentDir, 'implementation', 'progress.json'), JSON.stringify({
  tasks: [{ status: 'completed' }, { status: 'completed' }]
}))

console.log('\ncheckpoint implementation (advisory):')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`])
assert(result.status === 0, 'checkpoint passes (tools are advisory)')

console.log('\ncheckpoint implementation --json:')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`, '--json'])
assert(result.status === 0, 'checkpoint --json passes')
const output = result.stdout.trim()
try {
  const json = JSON.parse(output)
  assert(json.status === 'pass', 'json status is pass')
  assert(Array.isArray(json.warnings), 'json has warnings array')
} catch {
  assert(false, 'json output is valid JSON: ' + output.slice(0, 100))
}

writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), `# Test Plan

### Task 1: Research API
**Skills:** [mock-tool, test-driven-development]

Do research.

### Task 2: Implement
**Skills:** [test-driven-development]
**Skipped:** mock-tool — this task is pure refactoring, no research needed

Build it.
`)

console.log('\ncheckpoint with waiver:')
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`, '--json'])
const waiverJson = JSON.parse(result.stdout.trim())
const mockToolWarnings = waiverJson.warnings.filter(w => w.skill === 'mock-tool')
const skippedWarning = mockToolWarnings.find(w => w.code === 'TOOL_SKILL_SKIPPED')
assert(skippedWarning !== undefined || mockToolWarnings.length === 0, 'handles skipped skills')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
