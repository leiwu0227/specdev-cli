import { join } from 'node:path'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import {
  buildKnowledgeIndex,
  buildKnowledgeDistillationBrief,
  collectKnowledgeDocuments,
  knowledgeFreshness,
  searchKnowledgeIndex,
} from '../utils/knowledge.js'

const KNOWLEDGE_BRANCHES = ['faq', 'architecture', 'codestyle', 'domain', 'workflow', 'workflow_feedback']

export async function knowledgeCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  if (subcommand === 'rebuild' || subcommand === 'index') return knowledgeIndexCommand(flags)
  if (subcommand === 'search') return knowledgeSearchCommand(positionalArgs.slice(1), flags)
  if (subcommand === 'list') return knowledgeListCommand(flags)
  if (subcommand === 'distill') return knowledgeDistillCommand(flags)

  console.error(`Unknown knowledge subcommand: ${subcommand || '(none)'}`)
  console.log('Usage: specdev knowledge rebuild')
  console.log('       specdev knowledge search <keywords> [--scope=default|history|workflow|all] [--include-stale]')
  console.log('       specdev knowledge list')
  console.log('       specdev knowledge distill [--assignment=<id> | --mission=<id> | --discussion=<id>]')
  process.exitCode = 1
}

async function knowledgeIndexCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const result = await buildKnowledgeIndex(specdevPath)
  if (flags.json) {
    console.log(JSON.stringify({
      command: 'knowledge rebuild',
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
    console.error('Missing search keywords')
    console.log('Usage: specdev knowledge search <keywords>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  try {
    const limit = typeof flags.limit === 'string' ? Number(flags.limit) : undefined
    const results = await searchKnowledgeIndex(specdevPath, query, {
      scope: flags.scope || 'default',
      includeStale: Boolean(flags['include-stale']),
      limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
    })
    if (flags.json) {
      console.log(JSON.stringify({
        command: 'knowledge search',
        status: 'ok',
        query,
        scope: flags.scope || 'default',
        include_stale: Boolean(flags['include-stale']),
        results,
      }, null, 2))
      return
    }

    console.log(`Knowledge Search: ${query}`)
    if (results.length === 0) {
      console.log('No matches found.')
      if (!flags['include-stale']) console.log('Retry with --include-stale to check older FAQ guidance; revalidate it before use.')
      return
    }
    for (const result of results) {
      console.log('')
      console.log(`${result.path}`)
      console.log(`  Kind: ${result.kind}${result.assignment_id ? ` | Assignment: ${result.assignment_id}` : ''}`)
      console.log(`  Coverage: ${Math.round(result.coverage * 100)}% | Authority: ${result.authority}`)
      if (result.kind === 'faq') {
        console.log(`  Freshness: ${result.freshness}${result.review_after ? ` | Review after: ${result.review_after}` : ''}`)
      }
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
        ...(doc.kind === 'faq' ? {
          status: doc.knowledgeStatus || 'active',
          freshness: knowledgeFreshness(doc),
          verified_at: doc.verifiedAt,
          review_after: doc.reviewAfter,
        } : {}),
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
      const freshness = f.branch === 'faq' ? ` [${f.freshness}]` : ''
      console.log(`  ${f.path.replace(`knowledge/${branch}/`, '')} — ${f.title}${freshness}`)
    }
  }
  console.log(`\nTotal: ${files.length} file${files.length === 1 ? '' : 's'} across ${activeBranches.length} branch${activeBranches.length === 1 ? '' : 'es'}`)
}

async function knowledgeDistillCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const brief = await buildKnowledgeDistillationBrief(specdevPath, {
    assignment: typeof flags.assignment === 'string' ? flags.assignment : undefined,
    mission: typeof flags.mission === 'string' ? flags.mission : undefined,
    discussion: typeof flags.discussion === 'string' ? flags.discussion : undefined,
    limit: typeof flags.limit === 'string' ? flags.limit : undefined,
  })

  if (flags.json) {
    console.log(JSON.stringify(brief, null, 2))
    return brief
  }

  console.log('Knowledge Distillation Brief')
  console.log(`Unreferenced durable sources: ${brief.unreferenced_source_count}`)
  for (const source of brief.unreferenced_sources) console.log(`  ${source.path} — ${source.title}`)
  console.log(`Stale FAQs: ${brief.stale_faq_count}`)
  for (const faq of brief.stale_faqs) console.log(`  ${faq.path} — review after ${faq.review_after}`)
  console.log('Next: classify only reusable findings, update curated Markdown, cite source paths, then rebuild the index.')
  return brief
}
