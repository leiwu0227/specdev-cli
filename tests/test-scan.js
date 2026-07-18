import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { scanAssignments, readKnowledgeBranch, readProcessedCaptures, markCapturesProcessed } from '../src/utils/scan.js'

const TEST_DIR = './test-scan-output'
const SPECDEV = join(TEST_DIR, '.specdev')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })

  // Assignment with full structure
  const a1 = join(SPECDEV, 'assignments/00001_feature_auth')
  mkdirSync(join(a1, 'context/messages'), { recursive: true })
  mkdirSync(join(a1, 'tasks/01_api'), { recursive: true })
  mkdirSync(join(a1, 'scaffold'), { recursive: true })
  mkdirSync(join(a1, 'brainstorm'), { recursive: true })
  mkdirSync(join(a1, 'breakdown'), { recursive: true })
  mkdirSync(join(a1, 'implementation'), { recursive: true })
  writeFileSync(join(a1, 'brainstorm', 'proposal.md'), '# Proposal')
  writeFileSync(join(a1, 'brainstorm', 'design.md'), '# Design')
  writeFileSync(join(a1, 'breakdown', 'plan.md'), '# Plan')
  writeFileSync(join(a1, 'implementation', 'progress.json'), '{}')
  writeFileSync(join(a1, 'context/decisions.md'), '# Decisions\n## Decision 1')
  writeFileSync(join(a1, 'context/progress.md'), '# Progress')
  writeFileSync(join(a1, 'context/messages/001_msg.md'), 'hello')
  writeFileSync(join(a1, 'tasks/01_api/spec.md'), '# Spec')
  writeFileSync(join(a1, 'tasks/01_api/result.md'), '# Result\nDone.')
  writeFileSync(join(a1, 'scaffold/api.md'), '# Scaffold')

  // Capture diffs for a1
  mkdirSync(join(a1, 'capture'), { recursive: true })
  writeFileSync(join(a1, 'capture/project-notes-diff.md'), '# Project Notes Diff\n\n## Gaps Found\n- Missing API auth docs')
  writeFileSync(join(a1, 'capture/workflow-diff.md'), '# Workflow Diff\n\n## What Worked\n- TDD approach was effective')

  // Assignment with skipped phases (has implementation but no plan)
  const a2 = join(SPECDEV, 'assignments/00002_bugfix_login')
  mkdirSync(join(a2, 'brainstorm'), { recursive: true })
  mkdirSync(join(a2, 'implementation'), { recursive: true })
  writeFileSync(join(a2, 'brainstorm', 'proposal.md'), '# Proposal')
  writeFileSync(join(a2, 'implementation', 'progress.json'), '{}')

  // Knowledge branch
  const kb = join(SPECDEV, 'knowledge/codestyle')
  mkdirSync(kb, { recursive: true })
  writeFileSync(join(kb, 'naming.md'), '# Naming\nUse camelCase')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

async function runTests() {
  setup()

  let failures = 0

  function assert(condition, msg) {
    if (!condition) {
      console.error(`  ❌ ${msg}`)
      failures++
    } else {
      console.log(`  ✓ ${msg}`)
    }
  }

  // Test scanAssignments
  console.log('scanAssignments:')
  const assignments = await scanAssignments(SPECDEV)

  assert(assignments.length === 2, 'finds 2 assignments')

  const a1 = assignments.find((a) => a.name === '00001_feature_auth')
  assert(a1 !== undefined, 'finds assignment 00001')
  assert(a1.id === '00001', 'parses id')
  assert(a1.type === 'feature', 'parses type')
  assert(a1.label === 'auth', 'parses label')
  assert(a1.phases.brainstorm === true, 'detects brainstorm phase')
  assert(a1.phases.breakdown === true, 'detects breakdown phase')
  assert(a1.phases.review === false, 'detects missing review phase')
  assert(
    a1.skippedPhases.length === 0,
    'no skipped phases (validation not yet reached, not skipped)'
  )
  assert(a1.context !== null, 'has context')
  assert(a1.context.hasDecisions === true, 'has decisions')
  assert(a1.context.hasProgress === true, 'has progress')
  assert(a1.context.messageCount === 1, 'has 1 message')
  assert(a1.tasks !== null, 'has tasks')
  assert(a1.tasks.length === 1, 'has 1 task')
  assert(a1.tasks[0].hasSpec === true, 'task has spec')
  assert(a1.tasks[0].hasResult === true, 'task has result')
  assert(a1.hasScaffold === true, 'has scaffold')
  assert(a1.scaffoldCount === 1, 'scaffold has 1 file')

  assert(a1.capture !== null, 'has capture')
  assert(a1.capture.projectNotesDiff.includes('Missing API auth docs'), 'reads project-notes-diff content')
  assert(a1.capture.workflowDiff.includes('TDD approach'), 'reads workflow-diff content')

  const a2 = assignments.find((a) => a.name === '00002_bugfix_login')
  assert(a2 !== undefined, 'finds assignment 00002')
  assert(a2.type === 'bugfix', 'parses bugfix type')
  assert(a2.skippedPhases.includes('breakdown'), 'detects skipped breakdown')
  assert(a2.context === null, 'no context')
  assert(a2.tasks === null, 'no tasks')
  assert(a2.hasScaffold === false, 'no scaffold')
  assert(a2.capture === null, 'no capture')

  // Test readKnowledgeBranch
  console.log('\nreadKnowledgeBranch:')
  const codestyle = await readKnowledgeBranch(
    join(SPECDEV, 'knowledge'),
    'codestyle'
  )
  assert(codestyle.length === 1, 'finds 1 file in codestyle')
  assert(codestyle[0].file === 'naming.md', 'file is naming.md')
  assert(codestyle[0].content.includes('camelCase'), 'reads content')

  const empty = await readKnowledgeBranch(
    join(SPECDEV, 'knowledge'),
    'nonexistent'
  )
  assert(empty.length === 0, 'returns empty for nonexistent branch')

  // Test readProcessedCaptures / markCapturesProcessed
  console.log('\nprocessed captures tracking:')
  const knowledgePath = join(SPECDEV, 'knowledge')

  const emptyProject = await readProcessedCaptures(knowledgePath, 'project')
  assert(emptyProject.size === 0, 'empty set initially for project')

  const emptyWorkflow = await readProcessedCaptures(knowledgePath, 'workflow')
  assert(emptyWorkflow.size === 0, 'empty set initially for workflow')

  await markCapturesProcessed(knowledgePath, 'project', ['00001_feature_auth'])
  const afterProject = await readProcessedCaptures(knowledgePath, 'project')
  assert(afterProject.has('00001_feature_auth'), 'tracks project after write')
  assert(afterProject.size === 1, 'project set has 1 entry')

  const stillEmptyWorkflow = await readProcessedCaptures(knowledgePath, 'workflow')
  assert(stillEmptyWorkflow.size === 0, 'workflow still empty — types are independent')

  await markCapturesProcessed(knowledgePath, 'workflow', ['00001_feature_auth', '00002_bugfix_login'])
  const afterWorkflow = await readProcessedCaptures(knowledgePath, 'workflow')
  assert(afterWorkflow.has('00001_feature_auth'), 'workflow tracks first')
  assert(afterWorkflow.has('00002_bugfix_login'), 'workflow tracks second')
  assert(afterWorkflow.size === 2, 'workflow set has 2 entries')

  // Verify project wasn't affected by workflow write
  const projectStill = await readProcessedCaptures(knowledgePath, 'project')
  assert(projectStill.size === 1, 'project still has 1 entry after workflow write')

  // Test idempotent writes
  await markCapturesProcessed(knowledgePath, 'project', ['00001_feature_auth'])
  const afterDupe = await readProcessedCaptures(knowledgePath, 'project')
  assert(afterDupe.size === 1, 'idempotent — no duplicates after re-marking')

  // Test empty array is a no-op
  await markCapturesProcessed(knowledgePath, 'project', [])

  // Test empty assignments dir
  console.log('\nedge cases:')
  const emptyResult = await scanAssignments(join(TEST_DIR, 'nonexistent'))
  assert(emptyResult.length === 0, 'returns empty for missing specdev')

  cleanup()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} test(s) failed`)
    process.exit(1)
  } else {
    console.log('✅ All scan tests passed')
  }
}

runTests()
