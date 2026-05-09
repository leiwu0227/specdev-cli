import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveCurrentAssignment } from '../utils/current.js'
import { scanAssignments, scanSingleAssignment } from '../utils/scan.js'
import { detectAssignmentState } from '../utils/state.js'
import { COMMANDS } from '../utils/commands.js'
import { scanSkillsDir } from '../utils/skills.js'
import { collectKnowledgeDocuments } from '../utils/knowledge.js'

const KNOWLEDGE_BRANCHES = ['architecture', 'codestyle', 'domain', 'workflow', 'workflow_feedback']

export async function contextCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const json = Boolean(flags.json)
  await requireSpecdevDirectory(specdevPath)

  const pkg = await import('../../package.json', { with: { type: 'json' } })
  const cliVersion = pkg.default.version
  const releaseDate = pkg.default.releaseDate || null

  const assignment = await buildAssignmentInfo(specdevPath)
  const knowledge = await buildKnowledgeInfo(specdevPath)
  const projectNotes = await buildProjectNotesInfo(specdevPath)
  const skills = await buildSkillsInfo(specdevPath)
  const recentHistory = await buildRecentHistory(specdevPath)

  if (json) {
    const output = {
      command: 'context',
      version: 1,
      cli_version: cliVersion,
      release_date: releaseDate,
      assignment,
      commands: COMMANDS.map(c => ({ name: c.name, usage: c.usage, description: c.description })),
      knowledge,
      project_notes: projectNotes,
      skills,
      recent_history: recentHistory,
    }
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log(`\nSpecDev Context (v${cliVersion})`)
  console.log('')

  if (assignment) {
    console.log(`Assignment: ${assignment.name}`)
    console.log(`  Phase: ${assignment.phase || 'unknown'} | State: ${assignment.state}`)
  } else {
    console.log('Assignment: (none)')
  }
  console.log('')

  console.log(`Commands: ${COMMANDS.length} available (run specdev help for full list)`)
  console.log('')

  const branchCounts = {}
  for (const f of knowledge.files) {
    branchCounts[f.branch] = (branchCounts[f.branch] || 0) + 1
  }
  const branchNames = Object.keys(branchCounts)
  console.log(`Knowledge: ${knowledge.files.length} files across ${branchNames.length} branches`)
  for (const branch of branchNames) {
    console.log(`  ${branch}/ (${branchCounts[branch]} files)`)
  }
  if (knowledge.index_exists) {
    console.log(`  Index: built (${knowledge.indexed_document_count} documents)`)
  } else {
    console.log('  Index: not built (run specdev knowledge index)')
  }
  console.log('')

  console.log(`Project Notes: ${projectNotes.length} files`)
  if (projectNotes.length > 0) {
    console.log(`  ${projectNotes.map(p => p.split('/').pop()).join(', ')}`)
  }
  console.log('')

  console.log(`Skills: ${skills.core.length} core, ${skills.tools.length} tools`)
  if (recentHistory.last_completed_assignment) {
    console.log('')
    console.log(`Recent: last completed assignment ${recentHistory.last_completed_assignment}`)
  }
}

async function buildAssignmentInfo(specdevPath) {
  const current = await resolveCurrentAssignment(specdevPath)
  if (current.error) return null

  const summary = await scanSingleAssignment(current.path, current.name)
  const detected = await detectAssignmentState(summary, current.path)

  const idMatch = current.name.match(/^(\d+)/)
  const phase = detected.state.startsWith('brainstorm') ? 'brainstorm'
    : detected.state.startsWith('breakdown') ? 'breakdown'
    : detected.state.startsWith('implementation') ? 'implementation'
    : detected.state.startsWith('summary') || detected.state.startsWith('completed') ? 'summary'
    : detected.state.startsWith('revision') ? 'revision'
    : 'unknown'

  return {
    id: idMatch ? idMatch[1] : null,
    name: current.name,
    phase,
    state: detected.state,
    path: `assignments/${current.name}`,
  }
}

async function buildKnowledgeInfo(specdevPath) {
  const documents = await collectKnowledgeDocuments(specdevPath)
  const files = documents
    .filter((doc) => doc.path.startsWith('knowledge/'))
    .map((doc) => {
      const [, branch] = doc.path.split('/')
      if (!KNOWLEDGE_BRANCHES.includes(branch)) return null
      return {
        path: doc.path,
        branch,
        title: doc.title,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path))

  const dbPath = join(specdevPath, 'cache', 'knowledge.sqlite')
  const indexExists = await fse.pathExists(dbPath)
  let indexedDocumentCount = 0

  if (indexExists) {
    try {
      const sqlite = await import('node:sqlite')
      const db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
      const row = db.prepare('SELECT COUNT(*) as cnt FROM documents').get()
      indexedDocumentCount = row.cnt
      db.close()
    } catch {
      // sqlite unavailable or db corrupted — count stays 0
    }
  }

  return {
    files,
    index_exists: indexExists,
    indexed_document_count: indexedDocumentCount,
  }
}

async function buildProjectNotesInfo(specdevPath) {
  const notesDir = join(specdevPath, 'project_notes')
  if (!(await fse.pathExists(notesDir))) return []

  const entries = await fse.readdir(notesDir)
  return entries
    .filter(e => e.endsWith('.md') && !e.startsWith('.'))
    .map(e => `project_notes/${e}`)
}

async function buildSkillsInfo(specdevPath) {
  const coreDir = join(specdevPath, 'skills', 'core')
  const toolsDir = join(specdevPath, 'skills', 'tools')

  const coreSkills = await scanSkillsDir(coreDir, 'core')
  const toolSkills = await scanSkillsDir(toolsDir, 'tool')

  return {
    core: coreSkills.map(s => s.name),
    tools: toolSkills.map(s => s.name),
  }
}

async function buildRecentHistory(specdevPath) {
  const assignments = await scanAssignments(specdevPath)
  const completed = []

  for (const assignment of assignments) {
    const detected = await detectAssignmentState(assignment, assignment.path)
    if (detected.state === 'completed') {
      completed.push(assignment.name)
    }
  }

  completed.sort((a, b) => b.localeCompare(a))

  return {
    last_completed_assignment: completed[0] || null,
  }
}
