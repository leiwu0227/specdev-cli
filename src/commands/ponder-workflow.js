import { join } from 'path'
import fse from 'fs-extra'
import { scanAssignments } from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import {
  presentSuggestion,
  askCustomObservation,
  askYesNo,
} from '../utils/prompt.js'
import { blankLine } from '../utils/output.js'

/**
 * Interactive command that reviews recent assignments and helps
 * the user write workflow-level observations to _workflow_feedback/
 */
export async function ponderWorkflowCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')

  // Verify .specdev exists
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')
  const feedbackDir = join(knowledgePath, '_workflow_feedback')

  // Ensure directories exist
  await fse.ensureDir(feedbackDir)

  console.log('🔍 Scanning assignments for workflow observations...')
  blankLine()

  const assignments = await scanAssignments(specdevPath)

  if (assignments.length === 0) {
    console.log('No assignments found. Complete some assignments first,')
    console.log('then run this command to reflect on the workflow.')
    return
  }

  console.log(`Found ${assignments.length} assignment(s)`)

  // Generate rule-based suggestions
  const suggestions = generateWorkflowSuggestions(assignments)

  if (suggestions.length === 0) {
    blankLine()
    console.log('No workflow observations detected from scanning.')
  } else {
    console.log(`Generated ${suggestions.length} suggestion(s) to review`)
  }

  // Present each suggestion
  const accepted = []

  for (const suggestion of suggestions) {
    const result = await presentSuggestion(suggestion)
    if (result) {
      accepted.push(result)
    }
  }

  // Offer custom observations
  let addingCustom = true
  while (addingCustom) {
    const custom = await askCustomObservation()
    if (custom) {
      accepted.push({ action: 'custom', ...custom })
    } else {
      addingCustom = false
    }
  }

  if (accepted.length === 0) {
    blankLine()
    console.log('No observations to save. Done!')
    return
  }

  // Write to _workflow_feedback/
  const date = new Date().toISOString().split('T')[0]
  const filename = `${date}_workflow_observations.md`
  const filepath = join(feedbackDir, filename)

  let content = `## ${date} — Workflow Observations\n\n`

  for (const item of accepted) {
    content += `### ${item.title}\n`
    content += `${item.body}\n`
    content += `- **Source:** user-confirmed via \`specdev ponder workflow\`\n`
    content += '\n'
  }

  // Append if file already exists (multiple ponder sessions in one day)
  if (await fse.pathExists(filepath)) {
    const existing = await fse.readFile(filepath, 'utf-8')
    content = existing + '\n' + content
  }

  await fse.writeFile(filepath, content, 'utf-8')

  blankLine()
  console.log(`✅ Saved ${accepted.length} observation(s) to:`)
  console.log(`   ${filepath}`)
}

/**
 * Generate rule-based suggestions by analyzing assignment patterns
 */
function generateWorkflowSuggestions(assignments) {
  const suggestions = []

  // Check for skipped phases
  const skippedPhaseCounts = {}
  for (const a of assignments) {
    for (const phase of a.skippedPhases) {
      skippedPhaseCounts[phase] = (skippedPhaseCounts[phase] || 0) + 1
    }
  }

  for (const [phase, count] of Object.entries(skippedPhaseCounts)) {
    const phaseName = formatPhaseName(phase)
    if (count >= 2) {
      suggestions.push({
        title: `${phaseName} phase frequently skipped`,
        body:
          `The "${phaseName}" phase was skipped in ${count} of ${assignments.length} assignments.\n` +
          `This may indicate the guide for this phase is too heavyweight or doesn't fit all assignment types.\n` +
          `- **Observed in:** ${assignments.filter((a) => a.skippedPhases.includes(phase)).map((a) => a.name).join(', ')}`,
      })
    } else if (count === 1) {
      const skippedIn = assignments.find((a) =>
        a.skippedPhases.includes(phase)
      )
      suggestions.push({
        title: `${phaseName} phase skipped in one assignment`,
        body:
          `The "${phaseName}" phase was skipped in assignment "${skippedIn.name}".\n` +
          `Consider whether this phase needs a lighter-weight option for simpler tasks.`,
      })
    }
  }

  // Check for assignments without context/ (no short-term knowledge captured)
  const noContext = assignments.filter((a) => !a.context)
  if (noContext.length > 0) {
    suggestions.push({
      title: 'Assignments missing context tracking',
      body:
        `${noContext.length} assignment(s) have no context/ directory (decisions, progress).\n` +
        `The workflow guides may need to emphasize the importance of capturing decisions during work.\n` +
        `- **Assignments:** ${noContext.map((a) => a.name).join(', ')}`,
    })
  }

  // Check for assignments without tasks/ decomposition
  const noTasks = assignments.filter((a) => !a.tasks)
  const withTasks = assignments.filter((a) => a.tasks && a.tasks.length > 0)
  if (noTasks.length > 0 && withTasks.length > 0) {
    suggestions.push({
      title: 'Inconsistent task decomposition usage',
      body:
        `${withTasks.length} assignment(s) used task decomposition, but ${noTasks.length} did not.\n` +
        `Consider whether the planning guide should more clearly recommend when to decompose vs. not.\n` +
        `- **With tasks:** ${withTasks.map((a) => a.name).join(', ')}\n` +
        `- **Without tasks:** ${noTasks.map((a) => a.name).join(', ')}`,
    })
  }

  // Check for assignments with many inter-agent messages (possible communication overhead)
  const highMessages = assignments.filter(
    (a) => a.context && a.context.messageCount > 5
  )
  if (highMessages.length > 0) {
    suggestions.push({
      title: 'High inter-agent message volume',
      body:
        `${highMessages.length} assignment(s) had more than 5 inter-agent messages.\n` +
        `This may indicate task specs weren't detailed enough, causing excessive back-and-forth.\n` +
        `- **Assignments:** ${highMessages.map((a) => `${a.name} (${a.context.messageCount} messages)`).join(', ')}`,
    })
  }

  // Check for assignments without scaffold
  const noScaffold = assignments.filter(
    (a) => !a.hasScaffold && a.type !== 'familiarization'
  )
  if (noScaffold.length > 0 && noScaffold.length < assignments.length) {
    suggestions.push({
      title: 'Scaffolding usage varies across assignments',
      body:
        `${noScaffold.length} non-familiarization assignment(s) had no scaffold/ directory.\n` +
        `This can be valid for low-complexity work, but ensure each assignment documents the complexity decision in plan.md.\n` +
        `- **Assignments without scaffold:** ${noScaffold.map((a) => a.name).join(', ')}`,
    })
  }

  return suggestions
}

function formatPhaseName(phase) {
  return phase
    .replace('.md', '')
    .replace(/[\/_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
