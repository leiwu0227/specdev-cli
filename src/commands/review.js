import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'

/**
 * specdev review — Phase-aware manual review (separate session)
 *
 * Detects current phase from assignment artifacts and prints
 * appropriate review context for the reviewer.
 */
export async function reviewCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // Detect phase from artifacts (latest phase wins)
  const hasImplementation = await fse.pathExists(join(assignmentPath, 'implementation'))
  const hasPlan = await fse.pathExists(join(assignmentPath, 'breakdown', 'plan.md'))
  const hasDesign = await fse.pathExists(join(assignmentPath, 'brainstorm', 'design.md'))
  const hasProposal = await fse.pathExists(join(assignmentPath, 'brainstorm', 'proposal.md'))

  let phase
  if (hasImplementation) {
    phase = 'implementation'
  } else if (hasPlan) {
    phase = 'breakdown'
  } else if (hasDesign || hasProposal) {
    phase = 'brainstorm'
  } else {
    console.error('No reviewable artifacts found')
    console.log('   Complete at least the brainstorm phase first')
    process.exit(1)
  }

  console.log(`Manual Review: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log('')

  if (phase === 'brainstorm') {
    console.log('Review scope: Design completeness and feasibility')
    console.log('')
    console.log('Artifacts to review:')
    if (hasProposal) console.log(`   - ${name}/brainstorm/proposal.md`)
    if (hasDesign) console.log(`   - ${name}/brainstorm/design.md`)
    console.log('')
    console.log('Check:')
    console.log('  1. Is the design complete? Any missing sections?')
    console.log('  2. Is it feasible with the current tech stack?')
    console.log('  3. Are edge cases and error handling addressed?')
    console.log('  4. Is the scope appropriate (not too large)?')
  } else if (phase === 'breakdown') {
    console.log('Review scope: Plan completeness')
    console.log('')
    console.log('Artifacts to review:')
    console.log(`   - ${name}/breakdown/plan.md`)
    if (hasDesign) console.log(`   - ${name}/brainstorm/design.md (for reference)`)
    console.log('')
    console.log('Check:')
    console.log('  1. Does the plan cover all design requirements?')
    console.log('  2. Are tasks properly ordered by dependency?')
    console.log('  3. Does each task have exact file paths, code, and commands?')
    console.log('  4. Are tasks small enough (2-5 minutes each)?')
  } else if (phase === 'implementation') {
    console.log('Review scope: Spec compliance + code quality')
    console.log('')
    console.log('Artifacts to review:')
    console.log(`   - ${name}/brainstorm/design.md (what was requested)`)
    console.log(`   - ${name}/breakdown/plan.md (what was planned)`)
    console.log(`   - Changed code files (what was built)`)
    console.log('')
    console.log('Check:')
    console.log('  1. Spec compliance: does implementation match the design?')
    console.log('  2. Code quality: architecture, testing, style')
    console.log('  3. Tag findings as CRITICAL or MINOR')
    console.log('  4. Discuss findings with user before concluding')
  }

  console.log('')
  console.log('After review, return to the main session to approve or provide feedback.')
}
