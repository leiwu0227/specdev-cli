import { join } from 'path'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { approvePhase } from '../utils/approve-phase.js'
import { blankLine } from '../utils/output.js'
import { commandPhases } from '../utils/workflow-contract.js'
import { loadWorkflowDefinition, renderStepOutput, nextPhaseAfter, findGateStep } from '../utils/workflow-runtime.js'
import { readValidatedSessionState, clearSessionState } from '../utils/session-state.js'

const VALID_PHASES = commandPhases.approve

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
  const specdevPath = join(assignmentPath, '..', '..')
  const workflowInfo = await loadWorkflowDefinition(specdevPath)

  // Read sticky session-state (validated against .current); fed into the
  // continuation-block renderer below to choose interrupt:false vs interrupt:true.
  const sessionState = await readValidatedSessionState(specdevPath)

  const result = await approvePhase(assignmentPath, phase, workflowInfo)

  if (!result.approved) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'approve', version: 1, status: 'error', phase, assignment: name, approved: false, errors: result.errors }))
    } else if (phase === 'brainstorm') {
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

  // Build the manifest-driven continuation block before terminal-phase clears
  // the session-state (so sticky_resolved still reflects the live state).
  const gateStep = findGateStep(workflowInfo.workflow, phase)
  const nextPhase = nextPhaseAfter(workflowInfo.workflow, phase)
  const rendered = renderStepOutput(gateStep, { sessionState, nextPhase })
  const continuation = rendered.continuation || null

  // Terminal-phase clear: when the assignment becomes complete, drop sticky
  // session-state (design.md §Layer 3).
  if (phase === 'implementation') {
    await clearSessionState(specdevPath)
  }

  if (flags.json) {
    console.log(JSON.stringify({
      command: 'approve',
      version: 1,
      status: 'ok',
      phase,
      assignment: name,
      approved: true,
      next_action: 'Run specdev next --json and follow the returned action',
      continuation,
    }))
    return
  }

  if (phase === 'brainstorm') {
    console.log(`✅ Brainstorm approved for ${name}`)
  } else if (phase === 'implementation') {
    console.log(`✅ Implementation approved for ${name}`)
  }
  blankLine()
  printContinuationText(continuation, nextPhase)
}

function printContinuationText(continuation, nextPhase) {
  if (!continuation || !nextPhase) {
    console.log('Next step:')
    console.log('   Run specdev next --json and follow the returned action.')
    return
  }
  if (!continuation.interrupt && continuation.command) {
    console.log('Continuation (no user prompt required):')
    console.log(`   ${continuation.command}`)
    return
  }
  // interrupt:true → ask user to pick reviewer or skip review.
  console.log('Continuation (user input required):')
  console.log(`   Pick a reviewer for ${nextPhase}:`)
  console.log(`     specdev reviewloop ${nextPhase} --reviewer=<name> --autocontinue`)
  console.log('   Or skip review:')
  console.log(`     specdev approve ${nextPhase}`)
}
