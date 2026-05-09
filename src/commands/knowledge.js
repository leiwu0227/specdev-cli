import { join } from 'node:path'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import {
  buildKnowledgeIndex,
  collectKnowledgeDocuments,
  searchKnowledgeIndex,
} from '../utils/knowledge.js'

const KNOWLEDGE_BRANCHES = ['architecture', 'codestyle', 'domain', 'workflow', 'workflow_feedback']

export async function knowledgeCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  if (subcommand === 'index') return knowledgeIndexCommand(flags)
  if (subcommand === 'search') return knowledgeSearchCommand(positionalArgs.slice(1), flags)
  if (subcommand === 'list') return knowledgeListCommand(flags)

  console.error(`Unknown knowledge subcommand: ${subcommand || '(none)'}`)
  console.log('Usage: specdev knowledge index')
  console.log('       specdev knowledge search <query>')
  console.log('       specdev knowledge list')
  process.exitCode = 1
}

async function knowledgeIndexCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const result = await buildKnowledgeIndex(specdevPath)
  if (flags.json) {
    console.log(JSON.stringify({
      command: 'knowledge index',
      status: 'ok',
      database_path: result.databasePath,
      document_count: result.documentCount,
    }, null, 2))
    return
  }

  console.log(`Knowledge index refreshed: ${result.databasePath}`)
  console.log(`Indexed documents: ${result.documentCount}`)
}

async function knowledgeSearchCommand(positionalArgs = [], flags = {}) {
  const query = positionalArgs.join(' ').trim()
  if (!query) {
    console.error('Missing search query')
    console.log('Usage: specdev knowledge search <query>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  try {
    const results = await searchKnowledgeIndex(specdevPath, query)
    if (flags.json) {
      console.log(JSON.stringify({
        command: 'knowledge search',
        status: 'ok',
        query,
        results,
      }, null, 2))
      return
    }

    console.log(`Knowledge Search: ${query}`)
    if (results.length === 0) {
      console.log('No matches found.')
      return
    }
    for (const result of results) {
      console.log('')
      console.log(`${result.path}`)
      console.log(`  Kind: ${result.kind}${result.assignment_id ? ` | Assignment: ${result.assignment_id}` : ''}`)
      console.log(`  ${result.snippet}`)
    }
  } catch (error) {
    if (error.code === 'KNOWLEDGE_INDEX_MISSING') {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    throw error
  }
}

async function knowledgeListCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const branches = Object.fromEntries(KNOWLEDGE_BRANCHES.map((branch) => [branch, 0]))
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

  for (const file of files) {
    branches[file.branch] += 1
  }

  if (flags.json) {
    console.log(JSON.stringify({ command: 'knowledge list', version: 1, files, branches }, null, 2))
    return
  }

  console.log('Knowledge Files')
  const activeBranches = KNOWLEDGE_BRANCHES.filter(b => branches[b] > 0)
  if (activeBranches.length === 0) {
    console.log('\n  (no knowledge files)')
    return
  }
  for (const branch of activeBranches) {
    const branchFiles = files.filter(f => f.branch === branch)
    console.log(`\n${branch}/ (${branchFiles.length} file${branchFiles.length === 1 ? '' : 's'})`)
    for (const f of branchFiles) {
      console.log(`  ${f.path.replace(`knowledge/${branch}/`, '')} — ${f.title}`)
    }
  }
  console.log(`\nTotal: ${files.length} file${files.length === 1 ? '' : 's'} across ${activeBranches.length} branch${activeBranches.length === 1 ? '' : 'es'}`)
}
