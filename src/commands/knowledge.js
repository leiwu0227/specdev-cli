import { join } from 'node:path'
import fse from 'fs-extra'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import {
  buildKnowledgeIndex,
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

  const knowledgePath = join(specdevPath, 'knowledge')
  const files = []
  const branches = {}

  for (const branch of KNOWLEDGE_BRANCHES) {
    const branchDir = join(knowledgePath, branch)
    let count = 0
    if (await fse.pathExists(branchDir)) {
      const entries = await fse.readdir(branchDir)
      for (const entry of entries) {
        if (!entry.endsWith('.md') || entry.startsWith('.') || entry === '_index.md') continue
        const filePath = join(branchDir, entry)
        const content = await fse.readFile(filePath, 'utf-8')
        const h1Match = content.match(/^# (.+)$/m)
        const title = h1Match ? h1Match[1].trim() : entry.replace(/\.md$/, '')
        files.push({ path: `knowledge/${branch}/${entry}`, branch, title })
        count++
      }
    }
    branches[branch] = count
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
      const filename = f.path.split('/').pop()
      console.log(`  ${filename} — ${f.title}`)
    }
  }
  console.log(`\nTotal: ${files.length} file${files.length === 1 ? '' : 's'} across ${activeBranches.length} branch${activeBranches.length === 1 ? '' : 'es'}`)
}
