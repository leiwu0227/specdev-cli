import { join } from 'path'
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

export async function distillProjectCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')

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
        existing_knowledge: {
          codestyle: [],
          architecture: [],
          domain: [],
          workflow: [],
        },
        suggestions: [],
        knowledge_paths: {
          codestyle: '.specdev/knowledge/codestyle/',
          architecture: '.specdev/knowledge/architecture/',
          domain: '.specdev/knowledge/domain/',
          workflow: '.specdev/knowledge/workflow/',
        },
      }, null, 2))
      process.exitCode = 1
      return
    }
  }
  const processed = await readProcessedCaptures(knowledgePath, 'project')
  const unprocessed = scoped.filter(a => !processed.has(a.name))

  // Read existing knowledge
  const existingKnowledge = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    const entries = await readKnowledgeBranch(knowledgePath, branch)
    existingKnowledge[branch] = entries.map(e => e.file)
  }

  const suggestions = [
    ...generateProjectSuggestions(unprocessed, existingKnowledge),
    ...generateCaptureDiffSuggestions(unprocessed),
  ]

  const knowledgePaths = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    knowledgePaths[branch] = `.specdev/knowledge/${branch}/`
  }

  const output = {
    status: 'ok',
    scanned: scoped.length,
    unprocessed: unprocessed.length,
    existing_knowledge: existingKnowledge,
    suggestions,
    knowledge_paths: knowledgePaths,
  }

  console.log(JSON.stringify(output, null, 2))
}

function generateProjectSuggestions(assignments, existingKnowledge) {
  const suggestions = []

  // Analyze assignment types
  const typeCounts = {}
  for (const a of assignments) {
    if (a.type) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
    }
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count >= 2) {
      suggestions.push({
        branch: 'workflow',
        title: `Recurring ${type} assignments`,
        body: `${count} "${type}" assignments found.\n` +
          `Consider documenting common patterns for this type of work.\n` +
          `Assignments: ${assignments.filter(a => a.type === type).map(a => a.name).join(', ')}`,
        source: 'heuristic',
        assignments: assignments.filter(a => a.type === type).map(a => a.name),
      })
    }
  }

  // Check decisions for architectural patterns
  const withDecisions = assignments.filter(a => a.context && a.context.hasDecisions)
  if (withDecisions.length > 0 && existingKnowledge.architecture.length === 0) {
    suggestions.push({
      branch: 'architecture',
      title: 'Capture architectural decisions',
      body: `${withDecisions.length} assignment(s) contain decisions but no architecture knowledge exists.\n` +
        `Assignments: ${withDecisions.map(a => a.name).join(', ')}`,
      source: 'heuristic',
      assignments: withDecisions.map(a => a.name),
    })
  }

  // Suggest codestyle if 3+ assignments and no codestyle knowledge
  if (assignments.length >= 3 && existingKnowledge.codestyle.length === 0) {
    suggestions.push({
      branch: 'codestyle',
      title: 'Document code style patterns',
      body: `${assignments.length} assignments completed but no codestyle knowledge documented.`,
      source: 'heuristic',
      assignments: assignments.map(a => a.name),
    })
  }

  // Check for domain-specific assignments
  const domainRelated = assignments.filter(a => a.label && a.label.length > 0)
  if (domainRelated.length >= 2 && existingKnowledge.domain.length === 0) {
    suggestions.push({
      branch: 'domain',
      title: 'Capture domain concepts',
      body: `Assignments reference domain areas but no domain knowledge documented.`,
      source: 'heuristic',
      assignments: domainRelated.map(a => a.name),
    })
  }

  return suggestions
}

function generateCaptureDiffSuggestions(assignments) {
  const suggestions = []

  for (const a of assignments) {
    if (!a.capture || !a.capture.projectNotesDiff) continue

    suggestions.push({
      branch: 'architecture',
      title: `Capture diff from ${a.name}`,
      body: a.capture.projectNotesDiff,
      source: 'capture-diff',
      assignments: [a.name],
    })
  }

  return suggestions
}
