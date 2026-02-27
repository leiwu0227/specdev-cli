import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { blankLine } from '../utils/output.js'

const VALID_PHASES = ['brainstorm', 'implementation']

export async function approveCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev approve <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown approve phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  const statusPath = join(assignmentPath, 'status.json')
  let status = {}
  if (await fse.pathExists(statusPath)) {
    try {
      status = await fse.readJson(statusPath)
    } catch {
      status = {}
    }
  }

  if (phase === 'brainstorm') {
    // Verify checkpoint-level quality before approving
    const missing = []
    for (const file of ['brainstorm/proposal.md', 'brainstorm/design.md']) {
      const filePath = join(assignmentPath, file)
      if (!(await fse.pathExists(filePath))) {
        missing.push(`${file} (missing)`)
      } else {
        const content = await fse.readFile(filePath, 'utf-8')
        if (content.trim().length < 20) {
          missing.push(`${file} (empty or too short)`)
        }
      }
    }

    if (missing.length > 0) {
      console.error(`❌ Cannot approve brainstorm — checkpoint not met`)
      for (const item of missing) {
        console.log(`   Issue: ${item}`)
      }
      console.log('   Run specdev checkpoint brainstorm first')
      process.exitCode = 1
      return
    }

    status.brainstorm_approved = true
    await fse.writeJson(statusPath, status, { spaces: 2 })

    console.log(`✅ Brainstorm approved for ${name}`)
    blankLine()
    console.log('Proceed to breakdown and implementation:')
    console.log('   1. Read .specdev/skills/core/breakdown/SKILL.md and follow it')
    console.log('   2. After plan review passes, implementation starts automatically')
  } else if (phase === 'implementation') {
    // Verify checkpoint-level quality before approving
    const progressPath = join(assignmentPath, 'implementation', 'progress.json')
    if (!(await fse.pathExists(progressPath))) {
      console.error(`❌ Cannot approve implementation — progress.json missing`)
      console.log('   Run specdev checkpoint implementation first')
      process.exitCode = 1
      return
    }

    try {
      const raw = await fse.readJson(progressPath)
      if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
        console.error(`❌ Cannot approve implementation — no tasks found in progress.json`)
        console.log('   progress.json must have a tasks array with at least one task')
        process.exitCode = 1
        return
      }
      const incomplete = raw.tasks.filter(t => t.status !== 'completed')
      if (incomplete.length > 0) {
        console.error(`❌ Cannot approve implementation — ${incomplete.length} of ${raw.tasks.length} tasks not completed`)
        console.log('   Complete all tasks before approving')
        process.exitCode = 1
        return
      }
    } catch {
      console.error(`❌ Cannot approve implementation — progress.json is invalid`)
      console.log('   Run specdev checkpoint implementation first')
      process.exitCode = 1
      return
    }

    status.implementation_approved = true
    await fse.writeJson(statusPath, status, { spaces: 2 })

    console.log(`✅ Implementation approved for ${name}`)
    blankLine()
    console.log('Proceed to summary:')
    console.log('   Read .specdev/skills/core/knowledge-capture/SKILL.md and follow it')
  }
}
