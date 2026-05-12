import { join } from 'path'
import fse from 'fs-extra'

/**
 * Validate artifacts for a phase and update status.json on success.
 *
 * Manifest-driven: reads `requires:` and `gate:` from the phase's gate step
 * in the loaded workflow definition.
 *
 * @param {string} assignmentPath - absolute path to the assignment directory
 * @param {'brainstorm'|'implementation'} phase - phase to approve
 * @param {object} workflowInfo - loaded workflow definition from loadWorkflowDefinition
 * @returns {Promise<{ approved: boolean, errors: string[] }>}
 */
export async function approvePhase(assignmentPath, phase, workflowInfo) {
  if (!workflowInfo || !workflowInfo.workflow || !workflowInfo.workflow.phases) {
    return { approved: false, errors: ['approvePhase requires workflowInfo from loadWorkflowDefinition'] }
  }

  const phaseDef = workflowInfo.workflow.phases[phase]
  if (!phaseDef || !Array.isArray(phaseDef.steps)) {
    return { approved: false, errors: [`Unknown phase: ${phase}`] }
  }

  const gateStep = phaseDef.steps.find((s) => s && s.kind === 'gate')
  if (!gateStep) {
    return { approved: false, errors: [`Phase ${phase} has no gate step in manifest`] }
  }

  const requiredArtifacts = requirePathStrings(gateStep.requires)
  const gateField = gateStep.gate
  if (!gateField) {
    return { approved: false, errors: [`Gate step for ${phase} has no gate field`] }
  }

  const errors = []

  // Artifact presence/content check
  for (const artifact of requiredArtifacts) {
    const filePath = join(assignmentPath, artifact)
    if (!(await fse.pathExists(filePath))) {
      errors.push(`${artifact} (missing)`)
      continue
    }
    // Content validation for progress.json: must have all tasks complete.
    if (artifact.endsWith('progress.json')) {
      let raw
      try {
        raw = await fse.readJson(filePath)
      } catch {
        errors.push('progress.json is invalid')
        continue
      }
      if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
        errors.push('no tasks found in progress.json')
        continue
      }
      const incomplete = raw.tasks.filter(t => t.status !== 'completed')
      if (incomplete.length > 0) {
        errors.push(`${incomplete.length} of ${raw.tasks.length} tasks not completed`)
      }
      continue
    }
    // Default markdown content check
    const content = await fse.readFile(filePath, 'utf-8')
    if (content.trim().length < 20) {
      errors.push(`${artifact} (empty or too short)`)
    }
  }

  if (errors.length > 0) {
    return { approved: false, errors }
  }

  const status = await readStatus(assignmentPath)
  status[gateField] = true
  await writeStatus(assignmentPath, status)

  return { approved: true, errors: [] }
}

function requirePathStrings(requires) {
  if (!Array.isArray(requires)) return []
  const paths = []
  for (const entry of requires) {
    if (typeof entry === 'string' && entry.length > 0) paths.push(entry)
    else if (entry && typeof entry === 'object' && typeof entry.path === 'string') paths.push(entry.path)
  }
  return paths
}

async function readStatus(assignmentPath) {
  const statusPath = join(assignmentPath, 'status.json')
  if (await fse.pathExists(statusPath)) {
    try {
      return await fse.readJson(statusPath)
    } catch {
      return {}
    }
  }
  return {}
}

async function writeStatus(assignmentPath, status) {
  const statusPath = join(assignmentPath, 'status.json')
  await fse.writeJson(statusPath, status, { spaces: 2 })
}
