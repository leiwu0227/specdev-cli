import { join } from 'path'
import fse from 'fs-extra'
import {
  scanAssignments,
  readProcessedCaptures,
  readKnowledgeBranch,
} from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const KNOWLEDGE_BRANCHES = ['codestyle', 'architecture', 'domain', 'workflow']
const BIG_PICTURE_WORD_LIMIT = 2000

export async function distillCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (typeof flags.assignment !== 'string' || !flags.assignment.trim()) {
    console.error('Missing required --assignment flag')
    console.log('Usage: specdev distill --assignment=<name>')
    process.exitCode = 1
    return
  }

  const wanted = flags.assignment.trim()
  const knowledgePath = join(specdevPath, 'knowledge')

  const assignments = await scanAssignments(specdevPath)
  const match = assignments.find(a => a.name === wanted)

  if (!match) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Assignment not found: ${wanted}`,
    }, null, 2))
    process.exitCode = 1
    return
  }

  // Read capture diffs
  const capturePath = join(match.path, 'capture')
  let projectNotesDiff = null
  let workflowDiff = null

  const pndPath = join(capturePath, 'project-notes-diff.md')
  if (await fse.pathExists(pndPath)) {
    projectNotesDiff = await fse.readFile(pndPath, 'utf-8')
  }

  const wdPath = join(capturePath, 'workflow-diff.md')
  if (await fse.pathExists(wdPath)) {
    workflowDiff = await fse.readFile(wdPath, 'utf-8')
  }

  if (!projectNotesDiff && !workflowDiff) {
    console.log(JSON.stringify({
      status: 'no_captures',
      assignment: wanted,
      capture: { project_notes_diff: null, workflow_diff: null },
    }, null, 2))
    return
  }

  // Read existing knowledge file listings
  const knowledgeFiles = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    const entries = await readKnowledgeBranch(knowledgePath, branch)
    knowledgeFiles[branch] = entries.map(e => e.file)
  }

  // Workflow feedback files
  const feedbackDir = join(knowledgePath, '_workflow_feedback')
  let feedbackFiles = []
  if (await fse.pathExists(feedbackDir)) {
    feedbackFiles = (await fse.readdir(feedbackDir))
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
  }
  knowledgeFiles._workflow_feedback = feedbackFiles

  // Read big_picture word count
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  let bigPictureWordCount = 0
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    bigPictureWordCount = content.split(/\s+/).filter(Boolean).length
  }

  // Generate heuristics (combined project + workflow)
  const processed = await readProcessedCaptures(knowledgePath, 'project')
  const unprocessed = assignments.filter(a => !processed.has(a.name))
  const heuristics = [
    ...generateProjectHeuristics(unprocessed, knowledgeFiles),
    ...generateWorkflowHeuristics(unprocessed),
  ]

  const output = {
    status: 'ok',
    assignment: wanted,
    capture: {
      project_notes_diff: projectNotesDiff,
      workflow_diff: workflowDiff,
    },
    knowledge_files: knowledgeFiles,
    big_picture_path: '.specdev/project_notes/big_picture.md',
    big_picture_word_count: bigPictureWordCount,
    big_picture_word_limit: BIG_PICTURE_WORD_LIMIT,
    heuristics,
  }

  console.log(JSON.stringify(output, null, 2))
}

function generateProjectHeuristics(assignments, existingKnowledge) {
  const suggestions = []

  const typeCounts = {}
  for (const a of assignments) {
    if (a.type) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
    }
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count >= 2) {
      suggestions.push({
        title: `Recurring ${type} assignments`,
        body: `${count} "${type}" assignments found. Consider documenting common patterns.`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.type === type).map(a => a.name),
      })
    }
  }

  const withDecisions = assignments.filter(a => a.context && a.context.hasDecisions)
  if (withDecisions.length > 0 && existingKnowledge.architecture.length === 0) {
    suggestions.push({
      title: 'Capture architectural decisions',
      body: `${withDecisions.length} assignment(s) contain decisions but no architecture knowledge exists.`,
      source: 'heuristic',
      assignments: withDecisions.map(a => a.name),
    })
  }

  if (assignments.length >= 3 && existingKnowledge.codestyle.length === 0) {
    suggestions.push({
      title: 'Document code style patterns',
      body: `${assignments.length} assignments completed but no codestyle knowledge documented.`,
      source: 'heuristic',
      assignments: assignments.map(a => a.name),
    })
  }

  const domainRelated = assignments.filter(a => a.label && a.label.length > 0)
  if (domainRelated.length >= 2 && existingKnowledge.domain.length === 0) {
    suggestions.push({
      title: 'Capture domain concepts',
      body: `Assignments reference domain areas but no domain knowledge documented.`,
      source: 'heuristic',
      assignments: domainRelated.map(a => a.name),
    })
  }

  return suggestions
}

function generateWorkflowHeuristics(assignments) {
  const suggestions = []

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
        body: `The "${phase}" phase was skipped in ${count} assignments.`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.skippedPhases.includes(phase)).map(a => a.name),
      })
    }
  }

  const noContext = assignments.filter(a => !a.context)
  if (noContext.length > 0) {
    suggestions.push({
      title: 'Assignments missing context tracking',
      body: `${noContext.length} assignment(s) have no context/ directory.`,
      source: 'heuristic',
      assignments: noContext.map(a => a.name),
    })
  }

  const highMessages = assignments.filter(a => a.context && a.context.messageCount > 5)
  if (highMessages.length > 0) {
    suggestions.push({
      title: 'High inter-agent message volume',
      body: `${highMessages.length} assignment(s) had more than 5 inter-agent messages.`,
      source: 'heuristic',
      assignments: highMessages.map(a => a.name),
    })
  }

  return suggestions
}
