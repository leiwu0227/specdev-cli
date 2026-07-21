import { join } from 'node:path'
import { getState } from 'ripplegraph'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { hasWorkspaceEngine, workflowRootFor } from '../utils/engine.js'
import { readCurrentFocus } from '../utils/current.js'
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
