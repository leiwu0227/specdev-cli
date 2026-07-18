import { join } from 'path'
import fse from 'fs-extra'
import { getState } from 'ripplegraph'
import { resolveCurrentAssignment } from './current.js'
import { hasWorkspaceEngine, workflowRootFor } from './engine.js'

export async function shouldUseLegacyAssignmentRuntime(projectRoot) {
  if (!hasWorkspaceEngine(projectRoot)) return true

  try {
    const engineState = getState({ workflowRoot: workflowRootFor(projectRoot) })
    if (engineState.status === 'ok' && engineState.run?.status === 'active') return false
  } catch {
    return true
  }

  const specdevPath = join(projectRoot, '.specdev')
  const current = await resolveCurrentAssignment(specdevPath)
  if (current.error) return false

  const statusPath = join(current.path, 'status.json')
  if (!(await fse.pathExists(statusPath))) return true
  try {
    const status = await fse.readJson(statusPath)
    return status.implementation_approved !== true
  } catch {
    return true
  }
}
