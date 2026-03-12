import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName, parseAssignmentId } from '../utils/assignment.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { readActiveTools } from '../utils/active-tools.js'
import { blankLine } from '../utils/output.js'

const VALID_PHASES = ['brainstorm', 'implementation', 'discussion']

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

  if (phase === 'discussion') {
    if (!flags.discussion) {
      console.error('--discussion flag is required. Use specdev discuss --list to see available discussions.')
      process.exitCode = 1
      return
    }
    const targetDir = resolveTargetDir(flags)
    const specdevPath = join(targetDir, '.specdev')
    const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
    if (!resolved || resolved.error) {
      const msg = resolved?.error === 'malformed'
        ? `Invalid discussion ID "${flags.discussion}". Expected format: D0001`
        : `Discussion ${flags.discussion} not found.`
      console.error(msg)
      process.exitCode = 1
      return
    }
    // Run brainstorm validation against the discussion path
    // Discussion names parse as type null, so type defaults to 'feature' (intentional)
    await checkpointBrainstorm(resolved.path, resolved.name)
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  if (phase === 'brainstorm') {
    await checkpointBrainstorm(assignmentPath, name)
  } else if (phase === 'implementation') {
    await checkpointImplementation(assignmentPath, name, flags)
  }
}

const REQUIRED_SECTIONS = {
  feature:         ['Overview', 'Goals', 'Non-Goals', 'Design', 'Success Criteria'],
  bugfix:          ['Overview', 'Root Cause', 'Fix Design', 'Success Criteria'],
  refactor:        ['Overview', 'Non-Goals', 'Design', 'Success Criteria'],
  familiarization: ['Overview'],
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

  let designContent = ''
  if (!(await fse.pathExists(designPath))) {
    missing.push('brainstorm/design.md')
  } else {
    designContent = await fse.readFile(designPath, 'utf-8')
    if (designContent.trim().length < 20) {
      missing.push('brainstorm/design.md (empty or too short)')
    }
  }

  // Validate required sections based on assignment type
  if (designContent && missing.length === 0) {
    const parsed = parseAssignmentId(name)
    const type = parsed.type || 'feature'
    const required = REQUIRED_SECTIONS[type] || REQUIRED_SECTIONS.feature

    for (const section of required) {
      const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Strict heading match: exact section title only (no suffix words).
      const pattern = new RegExp(`^##\\s+${escaped}\\s*$`, 'm')
      if (!pattern.test(designContent)) {
        missing.push(`brainstorm/design.md missing required section: ## ${section}`)
      }
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
  console.log('   specdev reviewloop brainstorm — automated external review (e.g., Codex)')
  console.log('   specdev review brainstorm — manual review in a separate session')
  console.log('   specdev approve brainstorm — skip review and proceed to breakdown')
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
  console.log('   specdev reviewloop implementation — automated external review (e.g., Codex)')
  console.log('   specdev review implementation — manual review in a separate session')
  console.log('   specdev approve implementation — skip review and proceed to summary')
}
