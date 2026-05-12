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

function setCurrent(assignmentName) {
  const currentPath = join(TEST_DIR, '.specdev', '.current')
  writeFileSync(currentPath, assignmentName, 'utf-8')
}

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

setCurrent('001_feature_auth')
let result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 0, 'feature with all required sections passes')
assert(result.stdout.includes('Review, then continue if approved'), 'brainstorm checkpoint uses review-then-continue language')
assert(result.stdout.includes('If the user chooses automated review, ask reviewer type as a second multiple-choice question:'), 'brainstorm checkpoint uses second-tier reviewer choices')
assert(result.stdout.includes('Use one choice per reviewer config; do not ask for free-form reviewer text.'), 'brainstorm checkpoint forbids free-form reviewer choice')
assert(result.stdout.includes('Do not ask for free-form reviewer text'), 'brainstorm checkpoint reinforces bounded reviewer choices')

// Snapshot test: text-mode and --json mode derive labels from the same
// manifest source; choice ids and labels must be byte-identical between modes.
// This locks the manifest-as-truth contract for checkpoint output.
const textResult = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
const jsonResult = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, '--json'])
assert(textResult.status === 0 && jsonResult.status === 0, 'brainstorm checkpoint snapshot: both modes pass')
try {
  const json = JSON.parse(jsonResult.stdout.trim())
  const jsonChoices = (json.interaction?.choices) || []
  for (const choice of jsonChoices) {
    assert(textResult.stdout.includes(choice.label), `snapshot: text mode includes label "${choice.label}" for id ${choice.id}`)
    assert(textResult.stdout.includes(choice.command), `snapshot: text mode includes command "${choice.command}" for id ${choice.id}`)
  }
  assert(jsonChoices.some(c => c.id === 'reviewloop_autocontinue'), 'snapshot: brainstorm has reviewloop_autocontinue id')
  assert(jsonChoices.some(c => c.id === 'reviewloop_only'), 'snapshot: brainstorm has reviewloop_only id')
  assert(jsonChoices.some(c => c.id === 'manual_review'), 'snapshot: brainstorm has manual_review id')
  assert(jsonChoices.some(c => c.id === 'approve_skip_review'), 'snapshot: brainstorm has approve_skip_review id')
} catch (e) {
  assert(false, 'brainstorm snapshot test: invalid JSON or assertion failure: ' + (e?.message || jsonResult.stdout.slice(0, 120)))
}

result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'next --json passes for brainstorm checkpoint-ready assignment')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.next_action?.id === 'brainstorm.checkpoint', 'next action is brainstorm checkpoint')
  assert(json.workflow?.contract_version === 2, 'next action reports workflow contract version')
  assert(json.interaction?.type === 'choice', 'next action includes structured choice interaction')
  assert(json.interaction.choices.some(c => c.id === 'reviewloop_autocontinue'), 'next action includes autocontinue choice')
  assert(Array.isArray(json.trace) && json.trace.length > 0, 'next action includes trace')
} catch {
  assert(false, 'next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}

const manifestPath = join(TEST_DIR, '.specdev', 'workflow.yaml')
const manifest = readFileSync(manifestPath, 'utf-8')
writeFileSync(manifestPath, manifest.replace(
  'run: specdev checkpoint brainstorm',
  'run: specdev custom-checkpoint brainstorm'
))
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'next --json passes with customized manifest command')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.next_action?.command_line === 'specdev custom-checkpoint brainstorm', 'next action uses manifest command')
} catch {
  assert(false, 'custom manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
writeFileSync(manifestPath, manifest)

writeFileSync(manifestPath, manifest.replace('workflow_contract_version: 2\n\n', ''))
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for missing workflow contract version')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'missing workflow contract version reports workflow_manifest_invalid')
  assert(json.blockers?.some(blocker => blocker.detail.includes('workflow_contract_version must be 2')), 'missing workflow contract version reports supported version')
} catch {
  assert(false, 'missing contract version next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
writeFileSync(manifestPath, manifest)

console.log('\nnext --json — malformed manifest returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), 'hooks:\n  - id: [')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for malformed manifest')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'malformed manifest reports workflow_manifest_invalid')
  assert(json.blockers?.[0]?.detail.includes('parse error'), 'malformed manifest reports parse error detail')
} catch {
  assert(false, 'malformed manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

console.log('\nnext --json — type-invalid manifest returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), 'hooks: 123\n')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for type-invalid manifest')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'type-invalid manifest reports workflow_manifest_invalid')
  assert(json.blockers?.some(blocker => blocker.detail.includes('hooks must be an array')), 'type-invalid manifest reports hooks type error')
} catch {
  assert(false, 'type-invalid manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

console.log('\nnext --json — null hook entry returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), 'hooks:\n  -\n')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for null hook entry')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'null hook entry reports workflow_manifest_invalid')
  assert(json.blockers?.some(blocker => blocker.detail.includes('hooks entries must be mappings/objects')), 'null hook entry reports hook object error')
} catch {
  assert(false, 'null hook entry next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

console.log('\nnext --json — invalid phases manifest returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), 'workflow_contract_version: 2\nphases: 123\nhooks: []\n')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for invalid phases manifest')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'invalid phases manifest reports workflow_manifest_invalid')
  assert(json.blockers?.[0]?.detail.includes('phases must be a mapping/object'), 'invalid phases manifest reports phases type error')
} catch {
  assert(false, 'invalid phases manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

console.log('\nnext --json — scalar manifest returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), '42\n')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for scalar manifest')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'scalar manifest reports workflow_manifest_invalid')
  assert(json.blockers?.some(blocker => blocker.detail.includes('workflow.yaml must contain a mapping/object')), 'scalar manifest reports object requirement')
} catch {
  assert(false, 'scalar manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

console.log('\nnext --json — empty manifest returns blocker JSON:')
writeFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), '')
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 1, 'next exits non-zero for empty manifest')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'workflow_manifest_invalid', 'empty manifest reports workflow_manifest_invalid')
  assert(json.blockers?.some(blocker => blocker.detail.includes('workflow.yaml must contain a mapping/object')), 'empty manifest reports object requirement')
} catch {
  assert(false, 'empty manifest next --json outputs valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), { force: true })

mkdirSync(join(featureDir, 'breakdown'), { recursive: true })
mkdirSync(join(featureDir, 'implementation'), { recursive: true })
writeFileSync(join(featureDir, 'breakdown', 'plan.md'), '# Plan\n')
writeFileSync(join(featureDir, 'implementation', 'progress.json'), JSON.stringify({
  tasks: [{ status: 'completed' }]
}))
writeFileSync(join(featureDir, 'status.json'), JSON.stringify({
  brainstorm_approved: true,
  implementation_approved: true,
}))
result = runCmd(['next', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'next --json passes after implementation approval')
try {
  const json = JSON.parse(result.stdout.trim())
  assert(json.state === 'completed', 'next action completes after implementation approval')
  assert(json.hook_outcomes?.some(hook => hook.id === 'repo_knowledge_prompt' && hook.outcome === 'skipped'), 'next action surfaces advisory repo knowledge hook')
} catch {
  assert(false, 'next --json hook output is valid JSON: ' + result.stdout.slice(0, 120))
}
rmSync(join(featureDir, 'breakdown'), { recursive: true, force: true })
rmSync(join(featureDir, 'implementation'), { recursive: true, force: true })
rmSync(join(featureDir, 'status.json'), { force: true })

console.log('\nbrainstorm checkpoint — feature missing Non-Goals:')
const featureDir2 = join(TEST_DIR, '.specdev', 'assignments', '002_feature_search')
mkdirSync(join(featureDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(featureDir2, 'brainstorm', 'proposal.md'), 'Add full-text search to the app.')
writeFileSync(join(featureDir2, 'brainstorm', 'design.md'), `## Overview\nAdd search functionality.\n\n## Goals\nUsers can search content.\n\n## Design\nUse elasticsearch index.\n\n## Success Criteria\nSearch returns results within 200ms.\n`)

setCurrent('002_feature_search')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 1, 'feature missing Non-Goals fails')

console.log('\nbrainstorm checkpoint — bugfix with all sections:')
const bugfixDir = join(TEST_DIR, '.specdev', 'assignments', '003_bugfix_crash')
mkdirSync(join(bugfixDir, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir, 'brainstorm', 'proposal.md'), 'Fix null pointer crash on empty input.')
writeFileSync(join(bugfixDir, 'brainstorm', 'design.md'), `## Overview\nApp crashes when input is empty.\n\n## Root Cause\nMissing null check in parser.\n\n## Fix Design\nAdd guard clause before parsing.\n\n## Success Criteria\nEmpty input returns empty result without crash.\n`)

setCurrent('003_bugfix_crash')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 0, 'bugfix with all required sections passes')

console.log('\nbrainstorm checkpoint — bugfix missing Root Cause:')
const bugfixDir2 = join(TEST_DIR, '.specdev', 'assignments', '004_bugfix_timeout')
mkdirSync(join(bugfixDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir2, 'brainstorm', 'proposal.md'), 'Fix timeout on large uploads.')
writeFileSync(join(bugfixDir2, 'brainstorm', 'design.md'), `## Overview\nLarge uploads time out.\n\n## Fix Design\nIncrease timeout and add chunking.\n\n## Success Criteria\nUploads up to 100MB complete successfully.\n`)

setCurrent('004_bugfix_timeout')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 1, 'bugfix missing Root Cause fails')

console.log('\nbrainstorm checkpoint — familiarization with Overview:')
const famDir = join(TEST_DIR, '.specdev', 'assignments', '005_familiarization_codebase')
mkdirSync(join(famDir, 'brainstorm'), { recursive: true })

writeFileSync(join(famDir, 'brainstorm', 'proposal.md'), 'Understand the authentication module.')
writeFileSync(join(famDir, 'brainstorm', 'design.md'), `## Overview\nExplore the auth module to understand token flow and middleware chain.\n`)

setCurrent('005_familiarization_codebase')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 0, 'familiarization with Overview only passes')

console.log('\nbrainstorm checkpoint — refactor with all sections:')
const refactorDir = join(TEST_DIR, '.specdev', 'assignments', '006_refactor_db-layer')
mkdirSync(join(refactorDir, 'brainstorm'), { recursive: true })

writeFileSync(join(refactorDir, 'brainstorm', 'proposal.md'), 'Refactor database layer to use connection pooling.')
writeFileSync(join(refactorDir, 'brainstorm', 'design.md'), `## Overview\nReplace individual connections with a connection pool.\n\n## Non-Goals\nNo schema changes or migrations in this refactor.\n\n## Design\nIntroduce a pool manager that wraps pg.Pool.\n\n## Success Criteria\nAll existing tests pass. Connection count drops under load.\n`)

setCurrent('006_refactor_db-layer')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 0, 'refactor with all required sections passes')

console.log('\nbrainstorm checkpoint — unknown type falls back to feature:')
const unknownDir = join(TEST_DIR, '.specdev', 'assignments', '007_unknown_thing')
mkdirSync(join(unknownDir, 'brainstorm'), { recursive: true })

writeFileSync(join(unknownDir, 'brainstorm', 'proposal.md'), 'Do something with an unknown type assignment.')
writeFileSync(join(unknownDir, 'brainstorm', 'design.md'), `## Overview\nAn unknown type assignment.\n\n## Goals\nTest fallback behavior.\n\n## Non-Goals\nNothing excluded.\n\n## Design\nSimple implementation.\n\n## Success Criteria\nIt works.\n`)

setCurrent('007_unknown_thing')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 0, 'unknown type with feature sections passes')

console.log('\nbrainstorm checkpoint — strict heading matching:')
const strictDir = join(TEST_DIR, '.specdev', 'assignments', '009_feature_strict-headings')
mkdirSync(join(strictDir, 'brainstorm'), { recursive: true })

writeFileSync(join(strictDir, 'brainstorm', 'proposal.md'), 'Validate strict heading matching for required sections.')
writeFileSync(join(strictDir, 'brainstorm', 'design.md'), `## Overviewing\nWrong heading variant.\n\n## Goals and Scope\nWrong heading variant.\n\n## Non-Goals-ish\nWrong heading variant.\n\n## Design Draft\nWrong heading variant.\n\n## Success Criteria Maybe\nWrong heading variant.\n`)

setCurrent('009_feature_strict-headings')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 1, 'feature with suffix headings fails strict section matching')

console.log('\nbrainstorm checkpoint — missing proposal.md still fails:')
const noProposalDir = join(TEST_DIR, '.specdev', 'assignments', '008_feature_noproposal')
mkdirSync(join(noProposalDir, 'brainstorm'), { recursive: true })

writeFileSync(join(noProposalDir, 'brainstorm', 'design.md'), `## Overview\nHas design but no proposal.\n\n## Goals\nTest.\n\n## Non-Goals\nNone.\n\n## Design\nSimple.\n\n## Success Criteria\nWorks.\n`)

setCurrent('008_feature_noproposal')
result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
assert(result.status === 1, 'missing proposal.md still fails')

console.log('\ndiscussion checkpoint — no autocontinue:')
const discussionDir = join(TEST_DIR, '.specdev', 'discussions', 'D00001_review-ideas')
mkdirSync(join(discussionDir, 'brainstorm'), { recursive: true })
writeFileSync(join(discussionDir, 'brainstorm', 'proposal.md'), 'Discuss a possible review workflow improvement.')
writeFileSync(join(discussionDir, 'brainstorm', 'design.md'), `## Overview\nDiscuss review flow ideas.\n\n## Goals\nClarify possible workflow changes.\n\n## Non-Goals\nNo assignment approval.\n\n## Design\nCapture discussion output only.\n\n## Success Criteria\nDiscussion can be reviewed without assignment gates.\n`)
result = runCmd(['checkpoint', 'discussion', '--discussion=D00001', `--target=${TEST_DIR}`])
assert(result.status === 0, 'discussion checkpoint passes')
assert(result.stdout.includes('specdev reviewloop discussion --discussion=D00001 --reviewer=<name>'), 'discussion checkpoint prints review command')
assert(!result.stdout.includes('specdev reviewloop discussion --discussion=D00001 --reviewer=<name> --autocontinue'), 'discussion checkpoint does not print autocontinue command')
assert(!result.stdout.includes('continue if approved'), 'discussion checkpoint does not promise continuation')

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

console.log('\ncheckpoint implementation (advisory) + snapshot:')
setCurrent('001_feature_test')
const implTextResult = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`])
const implJsonResult = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, '--json'])
assert(implTextResult.status === 0 && implJsonResult.status === 0, 'implementation checkpoint snapshot: both modes pass')
result = implJsonResult
const output = result.stdout.trim()
try {
  const json = JSON.parse(output)
  assert(json.status === 'pass', 'json status is pass')
  assert(Array.isArray(json.warnings), 'json has warnings array')
  assert(json.interaction?.type === 'choice', 'implementation json includes choice interaction')
  const jsonChoices = json.interaction.choices || []
  for (const choice of jsonChoices) {
    assert(implTextResult.stdout.includes(choice.label), `snapshot: impl text mode includes label "${choice.label}"`)
    assert(implTextResult.stdout.includes(choice.command), `snapshot: impl text mode includes command "${choice.command}"`)
  }
  assert(jsonChoices.some(c => c.id === 'reviewloop_autocontinue'), 'snapshot: implementation has reviewloop_autocontinue id')
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
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, '--json'])
const waiverJson = JSON.parse(result.stdout.trim())
const mockToolWarnings = waiverJson.warnings.filter(w => w.skill === 'mock-tool')
const skippedWarning = mockToolWarnings.find(w => w.code === 'TOOL_SKILL_SKIPPED')
assert(skippedWarning !== undefined || mockToolWarnings.length === 0, 'handles skipped skills')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
