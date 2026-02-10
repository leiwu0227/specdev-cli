import fse from 'fs-extra'
import { join, basename } from 'path'

const WORKFLOW_PHASES = [
  'proposal.md',
  'plan.md',
  'implementation.md',
  'validation_checklist.md',
]

/**
 * Scans all assignments in the .specdev/assignments/ directory
 * Returns structured data about each assignment's state
 *
 * @param {string} specdevPath - Path to .specdev directory
 * @returns {Promise<Array<object>>} Array of assignment summaries
 */
export async function scanAssignments(specdevPath) {
  const assignmentsDir = join(specdevPath, 'assignments')

  if (!(await fse.pathExists(assignmentsDir))) {
    return []
  }

  const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
  const assignmentDirs = entries.filter((e) => e.isDirectory())

  const assignments = []

  for (const dir of assignmentDirs) {
    const assignmentPath = join(assignmentsDir, dir.name)
    const summary = await scanSingleAssignment(assignmentPath, dir.name)
    if (summary) {
      assignments.push(summary)
    }
  }

  return assignments
}

/**
 * Scans a single assignment directory
 *
 * @param {string} assignmentPath - Full path to assignment directory
 * @param {string} name - Directory name (e.g. "00001_feature_auth")
 * @returns {Promise<object|null>}
 */
async function scanSingleAssignment(assignmentPath, name) {
  const parsed = parseAssignmentName(name)

  // Detect which phases exist
  const phases = {}
  for (const phase of WORKFLOW_PHASES) {
    phases[phase] = await fse.pathExists(join(assignmentPath, phase))
  }

  // Detect skipped phases (a later phase exists but an earlier one doesn't)
  const skippedPhases = detectSkippedPhases(phases)

  // Read context if it exists
  const context = await scanContext(join(assignmentPath, 'context'))

  // Read tasks if they exist
  const tasks = await scanTasks(join(assignmentPath, 'tasks'))

  // Read scaffold files
  const scaffoldDir = join(assignmentPath, 'scaffold')
  const hasScaffold = await fse.pathExists(scaffoldDir)
  let scaffoldCount = 0
  if (hasScaffold) {
    const scaffoldFiles = await fse.readdir(scaffoldDir)
    scaffoldCount = scaffoldFiles.filter((f) => f.endsWith('.md')).length
  }

  return {
    name,
    path: assignmentPath,
    ...parsed,
    phases,
    skippedPhases,
    context,
    tasks,
    scaffoldCount,
    hasScaffold,
  }
}

/**
 * Parse assignment directory name into components
 * e.g. "00001_feature_auth" -> { id: "00001", type: "feature", label: "auth" }
 */
function parseAssignmentName(name) {
  const match = name.match(/^(\d+)_(\w+?)_(.+)$/)
  if (match) {
    return { id: match[1], type: match[2], label: match[3] }
  }
  return { id: null, type: null, label: name }
}

/**
 * Detect phases that were skipped (a later phase exists without an earlier one)
 */
function detectSkippedPhases(phases) {
  const ordered = WORKFLOW_PHASES
  const skipped = []
  let foundLater = false

  // Walk backwards — if we find an existing phase, mark earlier missing ones as skipped
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (phases[ordered[i]]) {
      foundLater = true
    } else if (foundLater) {
      skipped.push(ordered[i])
    }
  }

  return skipped
}

/**
 * Scan context/ directory for decisions, progress, messages
 */
async function scanContext(contextPath) {
  if (!(await fse.pathExists(contextPath))) {
    return null
  }

  const result = {
    hasDecisions: false,
    hasProgress: false,
    messageCount: 0,
    decisions: null,
    progress: null,
  }

  const decisionsPath = join(contextPath, 'decisions.md')
  if (await fse.pathExists(decisionsPath)) {
    result.hasDecisions = true
    result.decisions = await fse.readFile(decisionsPath, 'utf-8')
  }

  const progressPath = join(contextPath, 'progress.md')
  if (await fse.pathExists(progressPath)) {
    result.hasProgress = true
    result.progress = await fse.readFile(progressPath, 'utf-8')
  }

  const messagesPath = join(contextPath, 'messages')
  if (await fse.pathExists(messagesPath)) {
    const messages = await fse.readdir(messagesPath)
    result.messageCount = messages.filter(
      (f) => f.endsWith('.md') && !f.startsWith('.')
    ).length
  }

  return result
}

/**
 * Scan tasks/ directory for task summaries
 */
async function scanTasks(tasksPath) {
  if (!(await fse.pathExists(tasksPath))) {
    return null
  }

  const entries = await fse.readdir(tasksPath, { withFileTypes: true })
  const taskDirs = entries.filter((e) => e.isDirectory())

  const tasks = []

  for (const dir of taskDirs) {
    const taskPath = join(tasksPath, dir.name)
    const hasSpec = await fse.pathExists(join(taskPath, 'spec.md'))
    const hasResult = await fse.pathExists(join(taskPath, 'result.md'))
    const hasScratch = await fse.pathExists(join(taskPath, 'scratch.md'))

    let resultContent = null
    if (hasResult) {
      resultContent = await fse.readFile(join(taskPath, 'result.md'), 'utf-8')
    }

    tasks.push({
      name: dir.name,
      hasSpec,
      hasResult,
      hasScratch,
      resultContent,
    })
  }

  return tasks
}

/**
 * Reads existing knowledge from a branch
 *
 * @param {string} knowledgePath - Path to knowledge/ directory
 * @param {string} branch - Branch name (e.g. "codestyle", "architecture")
 * @returns {Promise<Array<{file: string, content: string}>>}
 */
export async function readKnowledgeBranch(knowledgePath, branch) {
  const branchPath = join(knowledgePath, branch)

  if (!(await fse.pathExists(branchPath))) {
    return []
  }

  const entries = await fse.readdir(branchPath)
  const files = entries.filter(
    (f) => f.endsWith('.md') && !f.startsWith('.')
  )

  const results = []
  for (const file of files) {
    const content = await fse.readFile(join(branchPath, file), 'utf-8')
    results.push({ file, content })
  }

  return results
}
