import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { approvePhase } from '../utils/approve-phase.js'
import { blankLine } from '../utils/output.js'

const VALID_PHASES = ['brainstorm', 'implementation']

export async function approveCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev approve <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown approve phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  const result = await approvePhase(assignmentPath, phase)

  if (!result.approved) {
    if (phase === 'brainstorm') {
      console.error(`❌ Cannot approve brainstorm — checkpoint not met`)
      for (const item of result.errors) {
        console.log(`   Issue: ${item}`)
      }
      console.log('   Run specdev checkpoint brainstorm first')
    } else if (phase === 'implementation') {
      const errorMsg = result.errors[0] || 'unknown error'
      console.error(`❌ Cannot approve implementation — ${errorMsg}`)
      if (errorMsg.includes('no tasks')) {
        console.log('   progress.json must have a tasks array with at least one task')
      } else if (errorMsg.includes('not completed')) {
        console.log('   Complete all tasks before approving')
      } else {
        console.log('   Run specdev checkpoint implementation first')
      }
    }
    process.exitCode = 1
    return
  }

  if (phase === 'brainstorm') {
    console.log(`✅ Brainstorm approved for ${name}`)
    blankLine()
    console.log('Proceed to breakdown:')
    console.log('   1. Read .specdev/skills/core/breakdown/SKILL.md and follow it')
    console.log('   2. After plan review passes, run `specdev implement` to start implementation')
  } else if (phase === 'implementation') {
    console.log(`✅ Implementation approved for ${name}`)
    blankLine()
    console.log('Proceed to summary:')
    console.log('   Read .specdev/skills/core/knowledge-capture/SKILL.md and follow it')
  }
}
