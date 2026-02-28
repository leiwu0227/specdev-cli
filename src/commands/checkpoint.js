import { join, isAbsolute } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { readActiveTools } from '../utils/active-tools.js'
import { blankLine } from '../utils/output.js'

const VALID_PHASES = ['brainstorm', 'implementation']

export async function checkpointCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev checkpoint <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown checkpoint phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  let assignmentPath
  // Accept assignment as positional arg (e.g. specdev checkpoint brainstorm 1)
  if (!flags.assignment && positionalArgs[1]) {
    flags.assignment = positionalArgs[1]
  }

  if (flags.assignment && isAbsolute(flags.assignment)) {
    assignmentPath = flags.assignment
  } else {
    assignmentPath = await resolveAssignmentPath(flags)
  }
  const name = assignmentName(assignmentPath)

  if (phase === 'brainstorm') {
    await checkpointBrainstorm(assignmentPath, name)
  } else if (phase === 'implementation') {
    await checkpointImplementation(assignmentPath, name, flags)
  }
}

async function checkpointBrainstorm(assignmentPath, name) {
  const missing = []

  const proposalPath = join(assignmentPath, 'brainstorm', 'proposal.md')
  const designPath = join(assignmentPath, 'brainstorm', 'design.md')

  if (!(await fse.pathExists(proposalPath))) {
    missing.push('brainstorm/proposal.md')
  } else {
    const content = await fse.readFile(proposalPath, 'utf-8')
    if (content.trim().length < 20) {
      missing.push('brainstorm/proposal.md (empty or too short)')
    }
  }

  if (!(await fse.pathExists(designPath))) {
    missing.push('brainstorm/design.md')
  } else {
    const content = await fse.readFile(designPath, 'utf-8')
    if (content.trim().length < 20) {
      missing.push('brainstorm/design.md (empty or too short)')
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Brainstorm checkpoint failed for ${name}`)
    for (const item of missing) {
      console.log(`   Missing: ${item}`)
    }
    blankLine()
    console.log('Generate the missing artifacts before requesting review.')
    process.exitCode = 1
    return
  }

  console.log(`✅ Brainstorm checkpoint passed for ${name}`)
  console.log('   brainstorm/proposal.md ✓')
  console.log('   brainstorm/design.md ✓')
  blankLine()
  console.log('Ready for review. User may run:')
  console.log('   specdev review brainstorm (optional, in separate session)')
  console.log('   specdev approve brainstorm (to proceed)')
}

async function checkpointImplementation(assignmentPath, name, flags = {}) {
  const missing = []

  const progressPath = join(assignmentPath, 'implementation', 'progress.json')

  if (!(await fse.pathExists(progressPath))) {
    missing.push('implementation/progress.json')
  } else {
    try {
      const raw = await fse.readJson(progressPath)
      if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
        missing.push('implementation/progress.json has no tasks array (expected tasks: [{status: "completed"}, ...])')
      } else {
        const incomplete = raw.tasks.filter(t => t.status !== 'completed')
        if (incomplete.length > 0) {
          missing.push(`${incomplete.length} of ${raw.tasks.length} tasks not completed`)
        }
      }
    } catch {
      missing.push('implementation/progress.json (invalid JSON)')
    }
  }

  if (missing.length > 0) {
    if (flags.json) {
      console.log(JSON.stringify({ status: 'fail', issues: missing, warnings: [] }, null, 2))
      process.exitCode = 1
      return
    }
    console.error(`❌ Implementation checkpoint failed for ${name}`)
    for (const item of missing) {
      console.log(`   Issue: ${item}`)
    }
    blankLine()
    console.log('Complete all tasks before requesting review.')
    process.exitCode = 1
    return
  }

  // Tool skill enforcement (advisory)
  const specdevPath = join(assignmentPath, '..', '..')
  const activeTools = await readActiveTools(specdevPath)
  const activeToolNames = Object.keys(activeTools.tools)
  const toolWarnings = []

  if (activeToolNames.length > 0) {
    const planPath = join(assignmentPath, 'breakdown', 'plan.md')
    let planContent = ''
    if (await fse.pathExists(planPath)) {
      planContent = await fse.readFile(planPath, 'utf-8')
    }

    const declaredSkills = new Set()
    const skippedSkills = new Map()
    for (const match of planContent.matchAll(/\*\*Skills:\*\*\s*\[([^\]]*)\]/g)) {
      match[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => declaredSkills.add(s))
    }
    for (const match of planContent.matchAll(/\*\*Skipped:\*\*\s*(\w[\w-]*)\s*—\s*(.+)/g)) {
      skippedSkills.set(match[1], match[2].trim())
    }

    for (const toolName of activeToolNames) {
      if (declaredSkills.has(toolName)) continue
      if (skippedSkills.has(toolName)) {
        toolWarnings.push({ code: 'TOOL_SKILL_SKIPPED', skill: toolName, reason: skippedSkills.get(toolName) })
      } else {
        toolWarnings.push({ code: 'TOOL_SKILL_UNUSED', skill: toolName, waiver: null })
      }
    }
  }

  // JSON output mode
  if (flags.json) {
    console.log(JSON.stringify({ status: 'pass', warnings: toolWarnings }, null, 2))
    return
  }

  // Normal output
  console.log(`✅ Implementation checkpoint passed for ${name}`)
  console.log('   All tasks completed ✓')

  if (toolWarnings.length > 0) {
    blankLine()
    console.log('Tool skill notes:')
    for (const w of toolWarnings) {
      if (w.code === 'TOOL_SKILL_SKIPPED') {
        console.log(`   ⏭ ${w.skill} — skipped: ${w.reason}`)
      } else {
        console.log(`   ⚠ ${w.skill} — active but not declared in plan`)
      }
    }
  }

  blankLine()
  console.log('Ready for review. User may run:')
  console.log('   specdev review implementation (optional, in separate session)')
  console.log('   specdev approve implementation (to proceed)')
}
