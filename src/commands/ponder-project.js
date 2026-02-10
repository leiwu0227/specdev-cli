import { join } from 'path'
import fse from 'fs-extra'
import { scanAssignments, readKnowledgeBranch } from '../utils/scan.js'
import {
  ask,
  askMultiLine,
  presentSuggestion,
  askChoice,
  askYesNo,
} from '../utils/prompt.js'

const KNOWLEDGE_BRANCHES = [
  'codestyle',
  'architecture',
  'domain',
  'workflow',
]

/**
 * Interactive command that reviews recent assignments and helps
 * the user build local project knowledge in knowledge/<branches>
 */
export async function ponderProjectCommand(flags = {}) {
  const targetDir =
    typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  // Verify .specdev exists
  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  const knowledgePath = join(specdevPath, 'knowledge')

  // Ensure knowledge directories exist
  for (const branch of KNOWLEDGE_BRANCHES) {
    await fse.ensureDir(join(knowledgePath, branch))
  }

  console.log('🔍 Scanning assignments for project knowledge...')
  console.log('')

  const assignments = await scanAssignments(specdevPath)

  if (assignments.length === 0) {
    console.log('No assignments found. Complete some assignments first,')
    console.log('then run this command to capture project knowledge.')
    return
  }

  console.log(`Found ${assignments.length} assignment(s)`)

  // Read existing knowledge for context
  const existingKnowledge = {}
  for (const branch of KNOWLEDGE_BRANCHES) {
    existingKnowledge[branch] = await readKnowledgeBranch(
      knowledgePath,
      branch
    )
  }

  // Generate suggestions
  const suggestions = generateProjectSuggestions(
    assignments,
    existingKnowledge
  )

  if (suggestions.length === 0) {
    console.log('')
    console.log('No new project knowledge suggestions detected.')
  } else {
    console.log(`Generated ${suggestions.length} suggestion(s) to review`)
  }

  // Present each suggestion grouped by branch
  const accepted = {} // branch -> [items]

  for (const suggestion of suggestions) {
    const result = await presentSuggestion({
      title: `[${suggestion.branch}] ${suggestion.title}`,
      body: suggestion.body,
    })
    if (result) {
      if (!accepted[suggestion.branch]) {
        accepted[suggestion.branch] = []
      }
      accepted[suggestion.branch].push({
        title: result.title.replace(`[${suggestion.branch}] `, ''),
        body: result.body,
      })
    }
  }

  // Offer custom observations with branch selection
  let addingCustom = true
  while (addingCustom) {
    const wantsCustom = await askYesNo(
      'Would you like to add a custom project observation?'
    )
    if (!wantsCustom) {
      addingCustom = false
      continue
    }

    const branchIdx = await askChoice(
      'Which knowledge branch?',
      KNOWLEDGE_BRANCHES
    )
    const branch = KNOWLEDGE_BRANCHES[branchIdx]

    const title = await ask('Title: ')
    if (!title) continue

    const body = await askMultiLine('Observation:')
    if (!body) continue

    if (!accepted[branch]) {
      accepted[branch] = []
    }
    accepted[branch].push({ title, body })
  }

  // Count total accepted
  const totalAccepted = Object.values(accepted).reduce(
    (sum, items) => sum + items.length,
    0
  )

  if (totalAccepted === 0) {
    console.log('')
    console.log('No observations to save. Done!')
    return
  }

  // Write to appropriate knowledge branches
  const date = new Date().toISOString().split('T')[0]

  for (const [branch, items] of Object.entries(accepted)) {
    const filename = `${date}_observations.md`
    const filepath = join(knowledgePath, branch, filename)

    let content = `## ${date} — Project Observations (${branch})\n\n`

    for (const item of items) {
      content += `### ${item.title}\n`
      content += `${item.body}\n`
      content += `- **Source:** user-confirmed via \`specdev ponder project\`\n`
      content += '\n'
    }

    // Append if file already exists
    if (await fse.pathExists(filepath)) {
      const existing = await fse.readFile(filepath, 'utf-8')
      content = existing + '\n' + content
    }

    await fse.writeFile(filepath, content, 'utf-8')
    console.log(`   ✓ ${branch}/${filename} (${items.length} observation(s))`)
  }

  // Update _index.md
  await updateKnowledgeIndex(knowledgePath)

  console.log('')
  console.log(`✅ Saved ${totalAccepted} observation(s) across ${Object.keys(accepted).length} branch(es)`)
}

/**
 * Generate rule-based project knowledge suggestions
 */
function generateProjectSuggestions(assignments, existingKnowledge) {
  const suggestions = []

  // Analyze assignment types for workflow patterns
  const typeCounts = {}
  for (const a of assignments) {
    if (a.type) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1
    }
  }

  // Suggest documenting common assignment types
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count >= 2) {
      suggestions.push({
        branch: 'workflow',
        title: `Recurring ${type} assignments`,
        body:
          `${count} "${type}" assignments have been completed.\n` +
          `Consider documenting common patterns and lessons learned for this type of work.\n` +
          `- **Assignments:** ${assignments.filter((a) => a.type === type).map((a) => a.name).join(', ')}`,
      })
    }
  }

  // Check decisions for architectural patterns
  const assignmentsWithDecisions = assignments.filter(
    (a) => a.context && a.context.hasDecisions && a.context.decisions
  )
  if (assignmentsWithDecisions.length > 0) {
    const hasArchKnowledge = existingKnowledge.architecture.length > 0
    if (!hasArchKnowledge) {
      suggestions.push({
        branch: 'architecture',
        title: 'Capture architectural decisions',
        body:
          `${assignmentsWithDecisions.length} assignment(s) contain decisions that may include architectural choices.\n` +
          `No architecture knowledge has been documented yet.\n` +
          `Review decisions in these assignments and extract architectural patterns:\n` +
          `- **Assignments:** ${assignmentsWithDecisions.map((a) => a.name).join(', ')}`,
      })
    }
  }

  // Suggest codestyle documentation if multiple assignments completed
  if (assignments.length >= 3) {
    const hasCodestyleKnowledge = existingKnowledge.codestyle.length > 0
    if (!hasCodestyleKnowledge) {
      suggestions.push({
        branch: 'codestyle',
        title: 'Document code style patterns',
        body:
          `${assignments.length} assignments have been completed, but no codestyle knowledge is documented.\n` +
          `Consider capturing naming conventions, error handling patterns, and test structure\n` +
          `that have emerged across assignments.`,
      })
    }
  }

  // Check for domain-specific assignments
  const domainRelated = assignments.filter(
    (a) => a.label && a.label.length > 0
  )
  const hasDomainKnowledge = existingKnowledge.domain.length > 0
  if (domainRelated.length >= 2 && !hasDomainKnowledge) {
    const labels = [...new Set(domainRelated.map((a) => a.label))]
    suggestions.push({
      branch: 'domain',
      title: 'Capture domain concepts',
      body:
        `Assignments reference these domain areas: ${labels.join(', ')}.\n` +
        `No domain knowledge has been documented yet.\n` +
        `Consider capturing key business concepts and terminology.`,
    })
  }

  // Check task results for implementation patterns
  const assignmentsWithResults = assignments.filter(
    (a) =>
      a.tasks && a.tasks.some((t) => t.hasResult && t.resultContent)
  )
  if (assignmentsWithResults.length >= 2) {
    suggestions.push({
      branch: 'architecture',
      title: 'Review task results for patterns',
      body:
        `${assignmentsWithResults.length} assignment(s) have completed task results.\n` +
        `Review these for recurring implementation patterns worth documenting:\n` +
        `- **Assignments:** ${assignmentsWithResults.map((a) => a.name).join(', ')}`,
    })
  }

  return suggestions
}

const INDEX_MARKER = '<!-- auto-generated by specdev ponder -->'

/**
 * Update knowledge/_index.md with current branch contents.
 * Only overwrites if the file was previously auto-generated (contains marker).
 * If the user has manually edited it (no marker), appends a generated section instead.
 */
async function updateKnowledgeIndex(knowledgePath) {
  const indexPath = join(knowledgePath, '_index.md')

  let generated = `${INDEX_MARKER}\n`
  generated += '## Branch Index\n\n'

  for (const branch of KNOWLEDGE_BRANCHES) {
    const branchPath = join(knowledgePath, branch)
    if (await fse.pathExists(branchPath)) {
      const files = (await fse.readdir(branchPath)).filter(
        (f) => f.endsWith('.md') && !f.startsWith('.')
      )
      if (files.length > 0) {
        generated += `### ${branch}/\n`
        for (const file of files) {
          generated += `- [${file}](${branch}/${file})\n`
        }
        generated += '\n'
      }
    }
  }

  const feedbackPath = join(knowledgePath, '_workflow_feedback')
  if (await fse.pathExists(feedbackPath)) {
    const files = (await fse.readdir(feedbackPath)).filter(
      (f) => f.endsWith('.md') && !f.startsWith('.')
    )
    if (files.length > 0) {
      generated += '### _workflow_feedback/\n'
      for (const file of files) {
        generated += `- [${file}](_workflow_feedback/${file})\n`
      }
      generated += '\n'
    }
  }

  // Check if existing file was auto-generated or manually edited
  if (await fse.pathExists(indexPath)) {
    const existing = await fse.readFile(indexPath, 'utf-8')

    if (existing.includes(INDEX_MARKER)) {
      // Replace the auto-generated section
      const markerIdx = existing.indexOf(INDEX_MARKER)
      const before = existing.slice(0, markerIdx).trimEnd()
      const content = before ? `${before}\n\n${generated}` : generated
      await fse.writeFile(indexPath, content, 'utf-8')
    } else {
      // User-edited file — append generated section
      const content = `${existing.trimEnd()}\n\n${generated}`
      await fse.writeFile(indexPath, content, 'utf-8')
    }
  } else {
    await fse.writeFile(indexPath, generated, 'utf-8')
  }
}
