import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine } from '../utils/output.js'
import { scanSkillsDir } from '../utils/skills.js'

export async function breakdownCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Check brainstorm artifacts exist
  const designPath = join(assignmentPath, 'brainstorm', 'design.md')

  if (!(await fse.pathExists(designPath))) {
    console.error('\u274C No brainstorm/design.md found')
    console.log('   Complete the brainstorm phase first with: specdev assignment')
    process.exit(1)
  }

  // Ensure breakdown directory exists
  const breakdownDir = join(assignmentPath, 'breakdown')
  await fse.ensureDir(breakdownDir)

  const revision = await readBrainstormRevision(
    join(assignmentPath, 'brainstorm', 'revision.json')
  )
  await fse.writeJson(
    join(breakdownDir, 'metadata.json'),
    {
      version: 1,
      based_on_brainstorm_revision: revision,
      timestamp: new Date().toISOString(),
    },
    { spaces: 2 }
  )

  console.log(`\uD83D\uDCCB Breakdown: ${name}`)
  blankLine()
  console.log('Read .specdev/skills/core/breakdown/SKILL.md and follow it.')
  console.log(`   Input: ${name}/brainstorm/design.md`)
  console.log(`   Output: ${name}/breakdown/plan.md`)
  blankLine()
  console.log('After plan is reviewed, implementation starts automatically.')
  console.log('Read .specdev/skills/core/implementing/SKILL.md and follow it.')
  console.log(`   Input: ${name}/breakdown/plan.md`)
  console.log(`   Output: committed code per task`)
  blankLine()
  console.log('Per-task flow:')
  console.log('  1. Dispatch implementer subagent (TDD: red → green → refactor)')
  console.log('  2. Spec review subagent (loop until PASS, max 10 rounds)')
  console.log('  3. Code quality review subagent (CRITICAL → fix, MINOR → note)')
  console.log('  4. Commit and mark task complete')

  // Print available tool skills so the breakdown agent knows what to declare
  const targetDir = resolveTargetDir(flags)
  const toolSkills = await scanSkillsDir(join(targetDir, '.specdev', 'skills', 'tools'), 'tool')
  if (toolSkills.length > 0) {
    blankLine()
    console.log('Available tool skills:')
    for (const skill of toolSkills) {
      const desc = skill.description ? ` — ${skill.description}` : ''
      console.log(`   ${skill.name}${desc}`)
    }
  }
}

async function readBrainstormRevision(path) {
  if (!(await fse.pathExists(path))) {
    return 0
  }
  try {
    const raw = await fse.readJson(path)
    const n = Number(raw?.revision)
    if (Number.isInteger(n) && n >= 0) {
      return n
    }
  } catch {
    // Fall back to baseline revision when metadata is unreadable.
  }
  return 0
}
