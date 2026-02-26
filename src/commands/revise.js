import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { readRevisionNumber } from '../utils/state.js'
import { blankLine } from '../utils/output.js'

export async function reviseCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Check brainstorm artifacts exist
  const designPath = join(assignmentPath, 'brainstorm', 'design.md')

  if (!(await fse.pathExists(designPath))) {
    console.error('\u274C No brainstorm/design.md found — nothing to revise')
    console.log('   Complete the brainstorm phase first with: specdev assignment')
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

  console.log(`\uD83D\uDD04 Revise: ${name}`)
  blankLine()
  console.log(`Recorded brainstorm revision: v${nextRevision}`)
  console.log('Existing breakdown/implementation artifacts were preserved.')

  blankLine()
  console.log('Re-entering brainstorm phase.')
  console.log(`Read the existing design first: ${name}/brainstorm/design.md`)
  console.log('Then follow .specdev/skills/core/brainstorming/SKILL.md — revise, don\'t start from scratch.')
}
