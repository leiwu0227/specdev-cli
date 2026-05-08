import { join } from 'node:path'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import {
  buildKnowledgeIndex,
  searchKnowledgeIndex,
} from '../utils/knowledge.js'

export async function knowledgeCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  if (subcommand === 'index') return knowledgeIndexCommand(flags)
  if (subcommand === 'search') return knowledgeSearchCommand(positionalArgs.slice(1), flags)

  console.error(`Unknown knowledge subcommand: ${subcommand || '(none)'}`)
  console.log('Usage: specdev knowledge index')
  console.log('       specdev knowledge search <query>')
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
