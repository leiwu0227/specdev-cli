import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { readRevisionNumber } from '../utils/state.js'
import { blankLine } from '../utils/output.js'
import { loadWorkflowDefinition, findProducedByBasename } from '../utils/workflow-runtime.js'

export async function reviseCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const specdevPath = join(resolveTargetDir(flags), '.specdev')
  const workflowInfo = await loadWorkflowDefinition(specdevPath)
  const designRel = findProducedByBasename(workflowInfo.workflow, 'brainstorm', 'design.md')
  if (!designRel) {
    console.error('Manifest does not declare a brainstorm design artifact')
    process.exitCode = 1
    return
  }

  // Check brainstorm artifacts exist
  const designPath = join(assignmentPath, designRel)

  if (!(await fse.pathExists(designPath))) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'revise', version: 1, status: 'error', assignment: name, message: `No ${designRel} found` }))
    } else {
      console.error(`❌ No ${designRel} found — nothing to revise`)
      console.log('   Complete the brainstorm phase first with: specdev assignment')
    }
    process.exitCode = 1
    return
  }

  const revisionPath = join(assignmentPath, 'brainstorm', 'revision.json')
  const current = (await readRevisionNumber(revisionPath, 'revision')) ?? 0
  const nextRevision = current + 1
  const timestamp = new Date().toISOString()

  await fse.writeJson(
    revisionPath,
    {
      version: 1,
      revision: nextRevision,
      timestamp,
      reason: 'manual_revise',
    },
    { spaces: 2 }
  )

  if (flags.json) {
    console.log(JSON.stringify({ command: 'revise', version: 1, status: 'ok', assignment: name, revision: nextRevision, revision_recorded: true, phase: 'brainstorm' }))
  } else {
    console.log(`🔄 Revise: ${name}`)
    blankLine()
    console.log(`Recorded brainstorm revision: v${nextRevision}`)
    console.log('Existing breakdown/implementation artifacts were preserved.')

    blankLine()
    console.log('Re-entering brainstorm phase.')
    console.log(`Read the existing design first: ${name}/${designRel}`)
    console.log('Then follow .specdev/skills/core/brainstorming/SKILL.md — revise, don\'t start from scratch.')
  }
}
