import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import {
  buildKnowledgeIndex,
  buildKnowledgeDistillationBrief,
  collectKnowledgeDocuments,
  knowledgeFreshness,
  searchKnowledgeIndex,
} from '../utils/knowledge.js'
import {
  applyKnowledgeCuration,
  cancelKnowledgeCuration,
  knowledgeCurationStatus,
  prepareKnowledgeCuration,
  scanKnowledgeCuration,
} from '../utils/knowledge-curation.js'

const KNOWLEDGE_BRANCHES = [
  'faq',
  'architecture',
  'codestyle',
  'domain',
  'workflow',
  'workflow_feedback',
]

export async function knowledgeCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  if (subcommand === 'rebuild' || subcommand === 'index') return knowledgeIndexCommand(flags)
  if (subcommand === 'search') return knowledgeSearchCommand(positionalArgs.slice(1), flags)
  if (subcommand === 'list') return knowledgeListCommand(flags)
  if (subcommand === 'distill') return knowledgeDistillCommand(flags)
  if (subcommand === 'curate') return knowledgeCurateCommand(flags)

  console.error(`Unknown knowledge subcommand: ${subcommand || '(none)'}`)
  console.log('Usage: specdev knowledge rebuild')
  console.log(
    '       specdev knowledge search <keywords> [--mode=precise|broad] [--scope=default|history|workflow|all] [--include-stale]'
  )
  console.log('       specdev knowledge list')
  console.log(
    '       specdev knowledge distill [--assignment=<id> | --mission=<id> | --discussion=<id>]'
  )
  console.log(
    '       specdev knowledge curate [--repo-evidence=<path#Lx-Ly,...> | --proposal=<path> | --approve=<sha256> [--approve-big-picture=<sha256>] | --status | --cancel]'
  )
  process.exitCode = 1
}

async function knowledgeCurateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  try {
    let result
    if (flags.cancel) {
      result = await cancelKnowledgeCuration(specdevPath)
      if (!result) result = { command: 'knowledge curate', version: 1, status: 'idle' }
    } else if (flags.status) {
      result = await knowledgeCurationStatus(specdevPath)
      if (!result) result = { command: 'knowledge curate', version: 1, status: 'idle' }
    } else if (typeof flags.proposal === 'string') {
      result = await prepareKnowledgeCuration(targetDir, specdevPath, flags.proposal)
    } else if (typeof flags.approve === 'string') {
      result = await applyKnowledgeCuration(targetDir, specdevPath, {
        proposal: flags.approve,
        bigPicture:
          typeof flags['approve-big-picture'] === 'string'
            ? flags['approve-big-picture']
            : undefined,
      })
    } else {
      const active = await knowledgeCurationStatus(specdevPath)
      result =
        active && active.status !== 'completed'
          ? active
          : await scanKnowledgeCuration(targetDir, specdevPath, {
              assignment: typeof flags.assignment === 'string' ? flags.assignment : undefined,
              mission: typeof flags.mission === 'string' ? flags.mission : undefined,
              discussion: typeof flags.discussion === 'string' ? flags.discussion : undefined,
              limit: typeof flags.limit === 'string' ? flags.limit : undefined,
              repositoryEvidence:
                typeof flags['repo-evidence'] === 'string' ? flags['repo-evidence'] : undefined,
            })
    }

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2))
      return result
    }
    printKnowledgeCuration(result)
    return result
  } catch (error) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          { command: 'knowledge curate', version: 1, status: 'error', error: error.message },
          null,
          2
        )
      )
    } else {
      console.error(`Knowledge curation stopped: ${error.message}`)
    }
    process.exitCode = 1
    return null
  }
}

function printKnowledgeCuration(result) {
  if (result.status === 'scan_ready') {
    console.log('Knowledge Curation Scan')
    console.log(`Scan: ${result.scan_id}`)
    console.log(`Eligible sources: ${result.eligible_source_count}`)
    console.log(`Stale FAQs: ${result.stale_faq_count}`)
    console.log(`Existing owners: ${result.owner_count}`)
    console.log(`Repository evidence: ${result.repository_evidence.length}`)
    console.log(`Excluded dirty paths: ${result.excluded_dirt.length}`)
    console.log(result.next_action)
    return
  }
  console.log(`Knowledge curation: ${result.status}`)
  if (result.proposal_id) console.log(`Proposal: ${result.proposal_id}`)
  if (result.confirmation) console.log(`Approve knowledge: ${result.confirmation}`)
  if (result.big_picture_confirmation)
    console.log(`Approve project context separately: ${result.big_picture_confirmation}`)
  if (result.receipt) console.log(`Receipt: .specdev/${result.receipt}`)
  if (result.recovery_command) console.log(`Recovery: ${result.recovery_command}`)
}

async function knowledgeIndexCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const result = await buildKnowledgeIndex(specdevPath)
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          command: 'knowledge rebuild',
          status: 'ok',
          database_path: result.databasePath,
          document_count: result.documentCount,
        },
        null,
        2
      )
    )
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
    const mode = typeof flags.mode === 'string' ? flags.mode : 'precise'
    const results = await searchKnowledgeIndex(specdevPath, query, {
      mode,
      scope: flags.scope || 'default',
      includeStale: Boolean(flags['include-stale']),
      limit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
    })
    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            command: 'knowledge search',
            status: 'ok',
            query,
            mode,
            scope: flags.scope || 'default',
            include_stale: Boolean(flags['include-stale']),
            fallback: results.some((result) => result.match_tier === 'partial_fallback'),
            refinement_hint: searchRefinementHint(mode, results),
            results,
          },
          null,
          2
        )
      )
      return
    }

    console.log(`Knowledge Search: ${query}`)
    console.log(`Mode: ${mode}`)
    if (results.length === 0) {
      console.log('No matches found.')
      console.log(searchRefinementHint(mode, results))
      if (!flags['include-stale'])
        console.log(
          'Retry with --include-stale to check older FAQ guidance; revalidate it before use.'
        )
      return
    }
    for (const result of results) {
      console.log('')
      console.log(`${result.path}`)
      console.log(
        `  Kind: ${result.kind}${result.assignment_id ? ` | Assignment: ${result.assignment_id}` : ''}`
      )
      console.log(
        `  Match: ${result.match_tier} | Coverage: ${Math.round(result.coverage * 100)}% | Authority: ${result.authority}`
      )
      console.log(
        `  Matched: ${
          [...result.matched_terms, ...result.matched_phrases.map((phrase) => `"${phrase}"`)].join(
            ', '
          ) || 'none'
        }`
      )
      if (result.kind === 'faq') {
        console.log(
          `  Freshness: ${result.freshness}${result.review_after ? ` | Review after: ${result.review_after}` : ''}`
        )
      }
      console.log(`  ${result.snippet}`)
    }
    const refinementHint = searchRefinementHint(mode, results)
    if (refinementHint) console.log(`\n${refinementHint}`)
  } catch (error) {
    if (error.code === 'KNOWLEDGE_INDEX_MISSING') {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    if (
      error.code === 'KNOWLEDGE_QUERY_INVALID' ||
      /invalid knowledge search mode/.test(error.message)
    ) {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    throw error
  }
}

function searchRefinementHint(mode, results) {
  if (results.some((result) => result.match_tier === 'partial_fallback')) {
    return 'Only partial evidence matched. Use --mode=broad for wider discovery, or remove generic terms and quote a distinguishing phrase to narrow the query.'
  }
  if (mode === 'broad') {
    return 'Broad mode matches any term. Omit --mode=broad and quote a distinguishing phrase to narrow the results.'
  }
  if (results.length === 0) {
    return 'Try --mode=broad for any-term discovery, or simplify the precise query without removing its distinguishing terms.'
  }
  return null
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
        ...(doc.kind === 'faq'
          ? {
              status: doc.knowledgeStatus || 'active',
              freshness: knowledgeFreshness(doc),
              verified_at: doc.verifiedAt,
              review_after: doc.reviewAfter,
            }
          : {}),
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
  const activeBranches = KNOWLEDGE_BRANCHES.filter((b) => branches[b] > 0)
  if (activeBranches.length === 0) {
    console.log('\n  (no knowledge files)')
    return
  }
  for (const branch of activeBranches) {
    const branchFiles = files.filter((f) => f.branch === branch)
    console.log(`\n${branch}/ (${branchFiles.length} file${branchFiles.length === 1 ? '' : 's'})`)
    for (const f of branchFiles) {
      const freshness = f.branch === 'faq' ? ` [${f.freshness}]` : ''
      console.log(`  ${f.path.replace(`knowledge/${branch}/`, '')} — ${f.title}${freshness}`)
    }
  }
  console.log(
    `\nTotal: ${files.length} file${files.length === 1 ? '' : 's'} across ${activeBranches.length} branch${activeBranches.length === 1 ? '' : 'es'}`
  )
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
  for (const faq of brief.stale_faqs)
    console.log(`  ${faq.path} — review after ${faq.review_after}`)
  console.log(
    'Next: classify only reusable findings, update curated Markdown, cite source paths, then rebuild the index.'
  )
  return brief
}
