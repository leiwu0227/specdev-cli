import { join, basename } from 'path'
import fse from 'fs-extra'
import { findLatestAssignment, scanSingleAssignment } from '../utils/scan.js'

const PHASE_ORDER = ['proposal.md', 'plan.md', 'implementation.md', 'validation_checklist.md']

const PHASE_NAMES = {
  'proposal.md': 'brainstorm',
  'plan.md': 'breakdown',
  'implementation.md': 'implementation',
  'validation_checklist.md': 'validation',
}

const PHASE_RULES = {
  brainstorm: [
    'Interactive Q&A to validate the design',
    'Produce proposal.md and design.md',
    'Do not start coding until design is approved',
  ],
  breakdown: [
    'Break design into executable tasks in breakdown/plan.md',
    'Each task must be small enough for one TDD cycle',
    'Include acceptance criteria for every task',
  ],
  implementation: [
    'TDD: write failing test → make it pass → refactor',
    'No completion claims without running tests',
    'One task at a time via subagents',
    'When done: specdev work request --gate=gate_3',
  ],
  validation: [
    'Run full test suite and verify all pass',
    'Check spec compliance against design.md',
    'When done: specdev work request --gate=gate_4',
  ],
}

const PHASE_NEXT = {
  brainstorm: 'Finalize design, then move to breakdown',
  breakdown: 'Complete plan.md, then start implementation',
  implementation: 'Complete remaining tasks, then request gate 3 review',
  validation: 'Verify everything passes, then request gate 4 review',
}

export async function remindCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  const latest = await findLatestAssignment(specdevPath)
  if (!latest) {
    console.error('❌ No assignments found')
    process.exit(1)
  }

  const name = basename(latest.path)
  const scan = await scanSingleAssignment(latest.path, name)

  // Determine current phase (last existing phase file)
  let currentPhase = 'brainstorm'
  for (const phase of PHASE_ORDER) {
    if (scan.phases[phase]) {
      currentPhase = PHASE_NAMES[phase]
    }
  }

  // Count completed phases
  const completedPhases = PHASE_ORDER.filter((p) => scan.phases[p]).map((p) => p.replace('.md', ''))

  // Count tasks if any
  let taskLine = ''
  if (scan.tasks && scan.tasks.length > 0) {
    const done = scan.tasks.filter((t) => t.hasResult).length
    const total = scan.tasks.length
    taskLine = `   Current:   ${done}/${total} tasks done`
  }

  // Output
  console.log(`📍 ${name} — ${currentPhase} phase`)
  console.log('')
  if (completedPhases.length > 0) {
    console.log(`   Completed: ${completedPhases.join(', ')}`)
  }
  if (taskLine) {
    console.log(taskLine)
  }
  console.log(`   Next:      ${PHASE_NEXT[currentPhase]}`)
  console.log('')
  console.log(`Rules for this phase:`)
  for (const rule of PHASE_RULES[currentPhase]) {
    console.log(`   • ${rule}`)
  }
  console.log('')
  console.log('IMPORTANT: Announce every subtask with "Using specdev: <action>"')
}
