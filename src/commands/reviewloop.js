import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine, printLines, printSection } from '../utils/output.js'

/**
 * specdev reviewloop <phase> — Automated external review loop (signal to agent)
 */
export async function reviewloopCommand(positionalArgs = [], flags = {}) {
  const VALID_PHASES = ['brainstorm', 'implementation']
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev reviewloop <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown reviewloop phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  blankLine()

  // Check artifacts exist
  if (phase === 'brainstorm') {
    const designPath = join(assignmentPath, 'brainstorm', 'design.md')
    if (await fse.pathExists(designPath)) {
      printSection('Artifact found:')
      console.log(`   ${name}/brainstorm/design.md`)
    } else {
      console.error('❌ brainstorm/design.md not found')
      console.log('   Complete brainstorming before running reviewloop.')
      process.exitCode = 1
      return
    }
  } else if (phase === 'implementation') {
    const planPath = join(assignmentPath, 'breakdown', 'plan.md')
    if (await fse.pathExists(planPath)) {
      printSection('Artifact found:')
      console.log(`   ${name}/breakdown/plan.md`)
    } else {
      printSection('No plan artifact found — reviewing code changes only.')
    }
  }

  // Scan for available reviewers
  const specdevDir = join(assignmentPath, '..', '..', '.specdev')
  const reviewersDir = join(specdevDir, 'skills', 'tools', 'reviewloop', 'reviewers')
  const reviewers = []
  if (await fse.pathExists(reviewersDir)) {
    const files = await fse.readdir(reviewersDir)
    for (const f of files) {
      if (f.endsWith('.json')) reviewers.push(f.replace('.json', ''))
    }
  }

  blankLine()
  if (reviewers.length > 0) {
    printSection('Available reviewers:')
    for (const r of reviewers) {
      console.log(`   - ${r}`)
    }
  } else {
    console.error('❌ No reviewer configs found')
    console.log('   Add reviewer JSON configs to .specdev/skills/tools/reviewloop/reviewers/')
    process.exitCode = 1
    return
  }

  blankLine()
  printSection('To run automated review, execute:')
  printLines([
    '   bash .specdev/skills/tools/reviewloop/scripts/reviewloop.sh \\',
    '     --reviewer <name> --round 1 --scope diff',
  ])

  blankLine()
  printSection('The agent should:')
  printLines([
    '  1. Pick a reviewer and scope',
    '  2. Run the script',
    '  3. Fix issues from findings',
    '  4. Re-run until pass or max rounds',
  ])
  blankLine()
}
