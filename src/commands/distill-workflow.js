import { join } from 'path'
import fse from 'fs-extra'
import {
  scanAssignments,
  readProcessedCaptures,
} from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

export async function distillWorkflowCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')
  const feedbackDir = join(knowledgePath, '_workflow_feedback')

  const assignments = await scanAssignments(specdevPath)
  let scoped = assignments
  if (typeof flags.assignment === 'string' && flags.assignment.trim()) {
    const wanted = flags.assignment.trim()
    scoped = assignments.filter((a) => a.name === wanted)
    if (scoped.length === 0) {
      console.log(JSON.stringify({
        status: 'error',
        error: `Assignment not found: ${wanted}`,
        scanned: assignments.length,
        unprocessed: 0,
        existing_knowledge: [],
        suggestions: [],
        knowledge_path: '.specdev/knowledge/_workflow_feedback/',
      }, null, 2))
      process.exitCode = 1
      return
    }
  }
  const processed = await readProcessedCaptures(knowledgePath, 'workflow')
  const unprocessed = scoped.filter(a => !processed.has(a.name))

  const suggestions = [
    ...generateWorkflowSuggestions(unprocessed),
    ...generateCaptureWorkflowSuggestions(unprocessed),
  ]

  // List existing feedback files
  let existingFiles = []
  if (await fse.pathExists(feedbackDir)) {
    existingFiles = (await fse.readdir(feedbackDir))
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
  }

  const output = {
    status: 'ok',
    scanned: scoped.length,
    unprocessed: unprocessed.length,
    existing_knowledge: existingFiles,
    suggestions,
    knowledge_path: '.specdev/knowledge/_workflow_feedback/',
  }

  console.log(JSON.stringify(output, null, 2))
}

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
    if (count >= 2) {
      suggestions.push({
        title: `${phase} phase frequently skipped`,
        body: `The "${phase}" phase was skipped in ${count} of ${assignments.length} assignments.\n` +
          `This may indicate the guide for this phase is too heavyweight.\n` +
          `Assignments: ${assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name).join(', ')}`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name),
      })
    }
  }

  // Check for assignments without context tracking
  const noContext = assignments.filter(a => !a.context)
  if (noContext.length > 0) {
    suggestions.push({
      title: 'Assignments missing context tracking',
      body: `${noContext.length} assignment(s) have no context/ directory.\n` +
        `Assignments: ${noContext.map(a => a.name).join(', ')}`,
      source: 'heuristic',
      assignments: noContext.map(a => a.name),
    })
  }

  // Check for high inter-agent message volume
  const highMessages = assignments.filter(a => a.context && a.context.messageCount > 5)
  if (highMessages.length > 0) {
    suggestions.push({
      title: 'High inter-agent message volume',
      body: `${highMessages.length} assignment(s) had more than 5 inter-agent messages.\n` +
        `Assignments: ${highMessages.map(a => `${a.name} (${a.context.messageCount} messages)`).join(', ')}`,
      source: 'heuristic',
      assignments: highMessages.map(a => a.name),
    })
  }

  return suggestions
}

function generateCaptureWorkflowSuggestions(assignments) {
  const suggestions = []

  for (const a of assignments) {
    if (!a.capture || !a.capture.workflowDiff) continue

    suggestions.push({
      title: `Workflow diff from ${a.name}`,
      body: a.capture.workflowDiff,
      source: 'capture-diff',
      assignments: [a.name],
    })
  }

  return suggestions
}
