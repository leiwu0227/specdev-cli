import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { scanAssignments, readKnowledgeBranch } from '../src/utils/scan.js'

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

  const a2 = assignments.find((a) => a.name === '00002_bugfix_login')
  assert(a2 !== undefined, 'finds assignment 00002')
  assert(a2.type === 'bugfix', 'parses bugfix type')
  assert(a2.skippedPhases.includes('breakdown'), 'detects skipped breakdown')
  assert(a2.context === null, 'no context')
  assert(a2.tasks === null, 'no tasks')
  assert(a2.hasScaffold === false, 'no scaffold')

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
