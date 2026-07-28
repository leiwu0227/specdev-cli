import { join } from 'node:path'
import { getState } from 'ripplegraph'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { hasWorkspaceEngine, workflowRootFor } from '../utils/engine.js'
import { readCurrentFocus } from '../utils/current.js'
import { readFocusedAssignmentLifecycle } from '../utils/assignment-lifecycle.js'
import { engineCommand } from './engine.js'

export async function continueCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  if (!hasWorkspaceEngine(targetDir))
    return fail(flags, 'Workflow registry unavailable; run specdev update')

  const state = getState({ workflowRoot: workflowRootFor(targetDir) })
  if (state.status === 'ok' && state.run?.status === 'active') {
    return engineCommand('next', [], flags)
  }
  const focus = await readCurrentFocus(specdevPath)
  const assignment =
    focus?.kind === 'assignment' ? await readFocusedAssignmentLifecycle(specdevPath) : null
  const payload =
    focus?.kind === 'mission'
      ? {
          command: 'continue',
          version: 2,
          status: 'ok',
          kind: 'mission',
          id: focus.id,
          next_action: `specdev mission status ${focus.id}`,
        }
      : focus?.kind === 'discussion'
        ? {
            command: 'continue',
            version: 2,
            status: 'ok',
            kind: 'discussion',
            id: focus.id,
            next_action: `specdev discussion ${focus.id}`,
          }
        : assignment
          ? {
              command: 'continue',
              version: 2,
              status: assignment.lifecycle === 'active' ? 'idle' : 'terminal',
              kind: 'assignment',
              id: assignment.id,
              lifecycle: assignment.lifecycle,
              immutable: assignment.immutable,
              message:
                assignment.lifecycle === 'shelved'
                  ? 'This Assignment is shelved and immutable; continuing creates a fresh successor ID and contract.'
                  : `This Assignment is ${assignment.lifecycle} and cannot resume its old execution run.`,
              next_action: assignment.next_action,
            }
          : {
              command: 'continue',
              version: 2,
              status: 'idle',
              kind: focus?.kind || null,
              id: focus?.id || null,
              next_action: 'specdev do "<intent>"',
            }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`SpecDev: ${payload.status}`)
    console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function fail(flags, message) {
  if (flags.json)
    console.log(
      JSON.stringify({ command: 'continue', version: 2, status: 'error', error: message })
    )
  else console.error(message)
  process.exitCode = 1
}
