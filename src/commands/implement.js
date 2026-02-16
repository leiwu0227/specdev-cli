import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'

export async function implementCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Check plan exists
  const planPath = join(assignmentPath, 'breakdown', 'plan.md')

  if (!(await fse.pathExists(planPath))) {
    console.error('❌ No breakdown/plan.md found')
    console.log('   Complete the breakdown phase first with: specdev breakdown')
    process.exit(1)
  }

  // Ensure implementation directory exists
  await fse.ensureDir(join(assignmentPath, 'implementation'))

  console.log(`🔨 Implement: ${name}`)
  console.log('')
  console.log('Read .specdev/skills/core/implementing/SKILL.md and follow it.')
  console.log(`   Input: ${name}/breakdown/plan.md`)
  console.log(`   Output: committed code per task`)
  console.log('')
  console.log('Per-task flow:')
  console.log('  1. Dispatch implementer subagent (TDD: red → green → refactor)')
  console.log('  2. Spec review subagent (loop until PASS, max 10 rounds)')
  console.log('  3. Code quality review subagent (CRITICAL → fix, MINOR → note)')
  console.log('  4. Commit and mark task complete')
}
