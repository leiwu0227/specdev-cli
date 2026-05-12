import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName, parseAssignmentId } from '../utils/assignment.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { readActiveTools } from '../utils/active-tools.js'
import { blankLine } from '../utils/output.js'
import { commandPhases, REQUIRED_BRAINSTORM_SECTIONS } from '../utils/workflow-contract.js'
import { loadWorkflowDefinition, renderStepOutput, findTopLevelInteraction } from '../utils/workflow-runtime.js'
import { listReviewers } from '../utils/reviewers.js'

const VALID_PHASES = commandPhases.checkpoint

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
      console.error('--discussion flag is required. Use specdev discussion --list to see available discussions.')
      process.exitCode = 1
      return
    }
    const targetDir = resolveTargetDir(flags)
    const specdevPath = join(targetDir, '.specdev')
    const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
    if (!resolved || resolved.error) {
      const msg = resolved?.error === 'malformed'
        ? `Invalid discussion ID "${flags.discussion}". Expected format: D00001`
        : `Discussion ${flags.discussion} not found.`
      console.error(msg)
      process.exitCode = 1
      return
    }
    // Run brainstorm validation against the discussion path
    // Discussion names parse as type null, so type defaults to 'feature' (intentional)
    await checkpointBrainstorm(resolved.path, resolved.name, flags)
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  if (phase === 'brainstorm') {
    await checkpointBrainstorm(assignmentPath, name, flags)
  } else if (phase === 'implementation') {
    await checkpointImplementation(assignmentPath, name, flags)
  }
}

function findPhaseStep(workflow, phase, stepId) {
  const phaseDef = workflow?.phases?.[phase]
  if (!phaseDef || !Array.isArray(phaseDef.steps)) return null
  return phaseDef.steps.find((s) => s && s.id === stepId) || null
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

function formatChoiceLine(index, choice) {
  const num = index + 1
  if (choice.requires_reviewer) {
    return `   ${num}. ${choice.label} — choose a reviewer, then run ${choice.command}`
  }
  if (choice.id === 'manual_review') {
    return `   ${num}. ${choice.label} — run ${choice.command} in a separate session`
  }
  return `   ${num}. ${choice.label} — run ${choice.command}`
}

async function checkpointBrainstorm(assignmentPath, name, flags = {}) {
  const missing = []
  const specdevPath = join(assignmentPath, '..', '..')
  const workflowInfo = await loadWorkflowDefinition(specdevPath)
  const workflow = workflowInfo.workflow

  const checkpointStep = findPhaseStep(workflow, 'brainstorm', 'checkpoint')
  const requiredArtifacts = requirePathStrings(checkpointStep?.requires)
  const proposalArtifact = requiredArtifacts.find((p) => p.endsWith('proposal.md')) || requiredArtifacts[0]
  const designArtifact = requiredArtifacts.find((p) => p.endsWith('design.md')) || requiredArtifacts[1]

  for (const artifact of requiredArtifacts) {
    const fullPath = join(assignmentPath, artifact)
    if (!(await fse.pathExists(fullPath))) {
      missing.push(artifact)
    } else {
      const content = await fse.readFile(fullPath, 'utf-8')
      if (content.trim().length < 20) {
        missing.push(`${artifact} (empty or too short)`)
      }
    }
  }

  // Validate required sections based on assignment type (content check on design.md)
  let designContent = ''
  if (designArtifact && missing.length === 0) {
    designContent = await fse.readFile(join(assignmentPath, designArtifact), 'utf-8')
    const parsed = parseAssignmentId(name)
    const type = parsed.type || 'feature'
    const required = REQUIRED_BRAINSTORM_SECTIONS[type] || REQUIRED_BRAINSTORM_SECTIONS.feature

    for (const section of required) {
      const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Strict heading match: exact section title only (no suffix words).
      const pattern = new RegExp(`^##\\s+${escaped}\\s*$`, 'm')
      if (!pattern.test(designContent)) {
        missing.push(`${designArtifact} missing required section: ## ${section}`)
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

  const reviewers = await listReviewers(specdevPath)
  const isDiscussion = Boolean(flags.discussion)
  const reviewPhase = isDiscussion ? 'discussion' : 'brainstorm'

  // Resolve the interaction source: top-level discussion_checkpoint for
  // discussions, the brainstorm checkpoint step's interaction for assignments.
  const interactionStep = isDiscussion
    ? { interaction: findTopLevelInteraction(workflow, 'discussion_checkpoint') }
    : checkpointStep

  const runtimeContext = {
    phase: reviewPhase,
    discussion: isDiscussion ? flags.discussion : null,
    reviewers,
  }
  const rendered = renderStepOutput(interactionStep, runtimeContext, { format: flags.json ? 'json' : 'text' })

  if (flags.json) {
    console.log(JSON.stringify({
      status: 'pass',
      phase: reviewPhase,
      assignment: isDiscussion ? null : name,
      discussion: isDiscussion ? flags.discussion : null,
      artifacts: requiredArtifacts,
      interaction: {
        type: 'choice',
        prompt: rendered.interaction?.prompt,
        choices: (rendered.interaction?.choices || []).map((c) => ({
          id: c.id,
          label: c.label,
          command: c.command,
          ...(c.requires_reviewer ? { requires_reviewer: true, reviewers: c.reviewers } : {}),
          ...(c.autocontinue ? { autocontinue: true } : {}),
        })),
      },
    }, null, 2))
    return
  }

  console.log(`✅ Brainstorm checkpoint passed for ${name}`)
  for (const artifact of requiredArtifacts) {
    console.log(`   ${artifact} ✓`)
  }
  blankLine()

  console.log('Ready for user decision. Present these multiple-choice options:')
  const choices = rendered.interaction?.choices || []
  choices.forEach((choice, index) => {
    console.log(formatChoiceLine(index, choice))
  })
  if (!isDiscussion) {
    console.log('   Review, then continue if approved keeps the workflow moving after approval.')
  }
  blankLine()
  console.log('If the user chooses automated review, ask reviewer type as a second multiple-choice question:')
  if (reviewers.length === 0) {
    console.log('   - No reviewer configs found. Add configs to .specdev/skills/core/reviewloop/reviewers/')
  } else {
    console.log('   Use one choice per reviewer config; do not ask for free-form reviewer text.')
    console.log('   Do not ask for free-form reviewer text.')
    reviewers.forEach((reviewer, index) => {
      console.log(`   ${index + 1}. ${reviewer}`)
    })
  }
}

async function checkpointImplementation(assignmentPath, name, flags = {}) {
  const missing = []
  const specdevPath = join(assignmentPath, '..', '..')
  const workflowInfo = await loadWorkflowDefinition(specdevPath)
  const workflow = workflowInfo.workflow

  const checkpointStep = findPhaseStep(workflow, 'implementation', 'checkpoint')
  const requiredArtifacts = requirePathStrings(checkpointStep?.requires)
  // Content validation: the implementation checkpoint's progress.json must
  // have a non-empty tasks[] with all tasks complete. Find the progress.json
  // entry in requires (today the only required artifact).
  const progressArtifact = requiredArtifacts.find((p) => p.endsWith('progress.json')) || requiredArtifacts[0]

  // Presence check for all required artifacts; content check on progress.json
  for (const artifact of requiredArtifacts) {
    const fullPath = join(assignmentPath, artifact)
    if (!(await fse.pathExists(fullPath))) {
      missing.push(artifact)
      continue
    }
    if (artifact === progressArtifact) {
      try {
        const raw = await fse.readJson(fullPath)
        if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
          missing.push(`${artifact} has no tasks array (expected tasks: [{status: "completed"}, ...])`)
        } else {
          const incomplete = raw.tasks.filter(t => t.status !== 'completed')
          if (incomplete.length > 0) {
            missing.push(`${incomplete.length} of ${raw.tasks.length} tasks not completed`)
          }
        }
      } catch {
        missing.push(`${artifact} (invalid JSON)`)
      }
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

  const reviewers = await listReviewers(specdevPath)
  const rendered = renderStepOutput(checkpointStep, {
    phase: 'implementation',
    discussion: null,
    reviewers,
  }, { format: flags.json ? 'json' : 'text' })

  // JSON output mode
  if (flags.json) {
    console.log(JSON.stringify({
      status: 'pass',
      phase: 'implementation',
      assignment: name,
      warnings: toolWarnings,
      interaction: {
        type: 'choice',
        prompt: rendered.interaction?.prompt,
        choices: (rendered.interaction?.choices || []).map((c) => ({
          id: c.id,
          label: c.label,
          command: c.command,
          ...(c.requires_reviewer ? { requires_reviewer: true, reviewers: c.reviewers } : {}),
          ...(c.autocontinue ? { autocontinue: true } : {}),
        })),
      },
    }, null, 2))
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
  console.log('Ready for user decision. Present these multiple-choice options:')
  const choices = rendered.interaction?.choices || []
  choices.forEach((choice, index) => {
    console.log(formatChoiceLine(index, choice))
  })
  blankLine()
  console.log('If the user chooses automated review, ask reviewer type as a second multiple-choice question:')
  if (reviewers.length === 0) {
    console.log('   - No reviewer configs found. Add configs to .specdev/skills/core/reviewloop/reviewers/')
  } else {
    console.log('   Use one choice per reviewer config; do not ask for free-form reviewer text.')
    reviewers.forEach((reviewer, index) => {
      console.log(`   ${index + 1}. ${reviewer}`)
    })
  }
}
