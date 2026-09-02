import { join, relative, resolve } from 'node:path'
import fse from 'fs-extra'
import { loadGuideCatalog } from './guides.js'
import { searchKnowledgeIndex } from './knowledge.js'

const GROUP_ORDER = ['authority', 'task', 'supporting', 'role_history']
const IMPLEMENTATION_PHASES = new Set([
  'implementation',
  'implementation-recovery',
  'implementation-repair',
  'implementation-review',
])
const MAX_SUPPORTING_ENTRIES = 10
const MAX_PROJECT_GUIDES = 3
const MAX_KNOWLEDGE_RESULTS = 3
const MAX_ROADMAP_DESIGNS = 2
const STOP_WORDS = new Set([
  'about',
  'after',
  'assignment',
  'before',
  'context',
  'from',
  'into',
  'only',
  'project',
  'should',
  'that',
  'their',
  'this',
  'with',
])

export async function buildAssignmentContextCatalog(options) {
  const {
    targetDir,
    specdevPath,
    assignmentPath,
    phase,
    role,
    guides = [],
    includePriorFindings = false,
  } = options
  if (!targetDir || !specdevPath || !assignmentPath || !phase || !role) {
    throw new Error(
      'Assignment context selection requires targetDir, specdevPath, assignmentPath, phase, and role'
    )
  }

  const statusPath = join(assignmentPath, 'status.json')
  const status = await readRequiredJson(statusPath, 'Assignment workflow state')
  const missionContext = status.mission
    ? await resolveMissionContext(targetDir, specdevPath, status.mission, status.id)
    : null
  const contractPath = join(assignmentPath, 'brainstorm', 'contract.md')
  const objective = await assignmentObjective(contractPath, status.description)
  const descriptors = []

  const repositoryInstructions = join(targetDir, 'AGENTS.md')
  if (await fse.pathExists(repositoryInstructions)) {
    descriptors.push(
      descriptor(
        'authority',
        'repository-instructions',
        repositoryInstructions,
        'Repository execution constraints'
      )
    )
  }
  descriptors.push(
    descriptor(
      'authority',
      'workflow-authority',
      join(specdevPath, '_main.md'),
      'Installed SpecDev workflow authority'
    )
  )
  if (missionContext) {
    descriptors.push(
      descriptor(
        'authority',
        'parent-contract',
        missionContext.contractPath,
        'Approved parent Mission authority'
      ),
      descriptor(
        'authority',
        'parent-delegation',
        missionContext.queuePath,
        'Parent Mission queue and child delegation'
      )
    )
  }
  if (IMPLEMENTATION_PHASES.has(phase)) {
    descriptors.push(
      descriptor('authority', 'approved-contract', contractPath, 'Approved Assignment contract')
    )
  }

  descriptors.push(
    descriptor('task', 'workflow-state', statusPath, 'Current Assignment workflow state')
  )
  descriptors.push(...taskDescriptors(assignmentPath, phase, role, includePriorFindings))

  const parentSupportingPaths = missionContext ? missionContext.supportingPaths : null
  descriptors.push(
    ...(await selectAssignmentSupportingContext({
      targetDir,
      specdevPath,
      objective,
      phase,
      role,
      guides,
      parentSupportingPaths,
    }))
  )

  if (includePriorFindings && role === 'primary-reviewer') {
    descriptors.push(
      descriptor(
        'role_history',
        'prior-findings',
        findingsPath(assignmentPath, phase),
        'Durable findings from the prior primary-review round'
      )
    )
  }

  const entries = await normalizeAndValidateEntries(targetDir, descriptors)
  return {
    version: 1,
    phase,
    role,
    entries,
    expansion_policy:
      'Regenerate this projection from durable sources when an unfamiliar convention, unexpected behavior, material repository change, or unresolved contradiction requires more context; absence never grants permission.',
    ...(missionContext
      ? {
          parent_supporting_envelope: missionContext.supportingPaths,
          parent_bounded: true,
        }
      : { parent_bounded: false }),
  }
}

export async function selectMissionSupportingEnvelope({
  targetDir,
  specdevPath,
  objective,
  knowledgePaths = null,
}) {
  const entries = await selectAssignmentSupportingContext({
    targetDir,
    specdevPath,
    objective,
    phase: 'mission-design',
    role: 'mission-planner',
    knowledgePaths,
  })
  return entries.map((entry) => repoRelative(targetDir, entry.path))
}

export function renderAssignmentContextCatalog(catalog) {
  const lines = [
    'Assignment selective context catalog (replaceable projection; owning artifacts remain authoritative):',
  ]
  for (const group of GROUP_ORDER) {
    lines.push(`${group}:`)
    const entries = catalog.entries.filter((entry) => entry.group === group)
    if (entries.length === 0) lines.push('- none')
    else {
      for (const entry of entries) {
        lines.push(`- ${entry.identity} | ${entry.path} | ${entry.purpose}`)
      }
    }
  }
  lines.push(catalog.expansion_policy)
  if (catalog.parent_bounded) {
    lines.push(
      'Mission boundary: supporting-context expansion must remain a subset of parent_supporting_envelope and cannot enlarge parent or child authority.'
    )
  }
  return lines.join('\n')
}

async function selectAssignmentSupportingContext({
  targetDir,
  specdevPath,
  objective,
  phase,
  guides = [],
  parentSupportingPaths,
  knowledgePaths = null,
}) {
  const candidates = []
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (await fse.pathExists(bigPicturePath)) {
    candidates.push(
      descriptor('supporting', 'project-context', bigPicturePath, 'Durable project context', {
        required: false,
      })
    )
  }

  const selectedGuidePaths = new Set(guides.map((guide) => resolve(guide.path)))
  for (const guide of guides.slice(0, MAX_PROJECT_GUIDES)) {
    candidates.push(
      descriptor(
        'supporting',
        guide.owner === 'project' ? 'project-guide' : 'workflow-guide',
        guide.path,
        `Selected guide ${guide.id}@${guide.version}`,
        { required: false }
      )
    )
  }
  if (phase === 'mission-design') {
    candidates.push(
      descriptor(
        'supporting',
        'workflow-guide',
        join(specdevPath, 'guides', 'review.md'),
        'Common independent-review guidance',
        { required: false }
      )
    )
  }
  let projectGuides = []
  try {
    const guidePhase =
      phase === 'mission-design'
        ? 'mission'
        : phase.startsWith('contract')
          ? 'brainstorm'
          : 'implementation'
    projectGuides = (await loadGuideCatalog(specdevPath))
      .filter((guide) => guide.phases.includes(guidePhase))
      .map((guide) => ({ guide, score: relevanceScore(objective, guideSearchText(guide)) }))
      .filter(({ guide, score }) => score > 0 || selectedGuidePaths.has(resolve(guide.path)))
      .sort(
        (left, right) =>
          Number(selectedGuidePaths.has(resolve(right.guide.path))) -
            Number(selectedGuidePaths.has(resolve(left.guide.path))) ||
          right.score - left.score ||
          left.guide.id.localeCompare(right.guide.id)
      )
      .slice(0, MAX_PROJECT_GUIDES)
      .map(({ guide }) => guide)
  } catch {
    projectGuides = []
  }
  for (const guide of projectGuides) {
    candidates.push(
      descriptor(
        'supporting',
        guide.owner === 'project' ? 'project-guide' : 'workflow-guide',
        guide.path,
        `Relevant guide ${guide.id}@${guide.version}`,
        { required: false }
      )
    )
  }

  const knowledgeResults = Array.isArray(knowledgePaths)
    ? knowledgePaths.map((path) => ({ path: String(path).replace(/^\.specdev\//, '') }))
    : await freshKnowledgeResults(specdevPath, objective)
  for (const result of knowledgeResults) {
    candidates.push(
      descriptor(
        'supporting',
        'living-knowledge',
        join(specdevPath, result.path),
        'Fresh living-knowledge result',
        { required: false }
      )
    )
  }

  for (const path of await relevantRoadmapDesigns(specdevPath, objective)) {
    candidates.push(
      descriptor('supporting', 'roadmap-design', path, 'Relevant approved Roadmap design', {
        required: false,
      })
    )
  }

  const allowed = parentSupportingPaths
    ? new Set(parentSupportingPaths.map((path) => normalizeRelativePath(path)))
    : null
  const seen = new Set()
  return candidates
    .filter((entry) => !allowed || allowed.has(repoRelative(targetDir, entry.path)))
    .filter((entry) => {
      const path = repoRelative(targetDir, entry.path)
      if (seen.has(path)) return false
      seen.add(path)
      return true
    })
    .slice(0, MAX_SUPPORTING_ENTRIES)
}

function taskDescriptors(assignmentPath, phase, role, includePriorFindings) {
  const contractPath = join(assignmentPath, 'brainstorm', 'contract.md')
  const baselinePath = join(assignmentPath, 'review', 'brainstorm-baseline.md')
  const planPath = join(assignmentPath, 'design', 'plan.md')
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')
  const outcomePath = join(assignmentPath, 'outcome.md')
  const candidatePath = join(assignmentPath, 'review', 'candidate-receipt.json')
  const verdictPath = findingsPath(assignmentPath, phase)

  if (phase === 'contract-author') return []
  if (phase === 'contract-review') {
    const entries = [
      descriptor('task', 'candidate-contract', contractPath, 'Assignment contract under review'),
      descriptor('task', 'contract-baseline', baselinePath, 'Frozen contract comparison baseline'),
    ]
    if (role === 'arbiter') {
      entries.push(descriptor('task', 'review-findings', verdictPath, 'Findings to arbitrate'))
    }
    return entries
  }
  if (phase === 'contract-repair') {
    return [
      descriptor('task', 'candidate-contract', contractPath, 'Assignment contract to repair'),
      descriptor('task', 'review-findings', verdictPath, 'Blocking contract-review findings'),
    ]
  }

  const delivery = [
    descriptor('task', 'design-plan', planPath, 'Current ordered implementation plan', {
      required: !['implementation', 'implementation-recovery'].includes(phase),
    }),
    descriptor(
      'task',
      'progress-evidence',
      progressPath,
      'Current progress and verification receipts',
      {
        required: !['implementation', 'implementation-recovery'].includes(phase),
      }
    ),
    descriptor('task', 'outcome', outcomePath, 'Current Assignment outcome', {
      required: !['implementation', 'implementation-recovery'].includes(phase),
    }),
  ]
  if (phase === 'implementation-review') {
    delivery.push(
      descriptor(
        'task',
        'candidate-receipt',
        candidatePath,
        'Exact candidate identity and evidence'
      )
    )
    if (role === 'arbiter') {
      delivery.push(
        descriptor('task', 'review-findings', verdictPath, 'Primary findings to arbitrate')
      )
    } else if (includePriorFindings) {
      // Prior primary findings are appended as role history after supporting context.
    }
  }
  if (phase === 'implementation-repair') {
    delivery.push(
      descriptor('task', 'review-findings', verdictPath, 'Blocking implementation-review findings')
    )
  }
  return delivery
}

async function normalizeAndValidateEntries(targetDir, descriptors) {
  const entries = []
  const seenPaths = new Map()
  for (const input of descriptors) {
    const path = repoRelative(targetDir, input.path)
    const previous = seenPaths.get(path)
    if (previous) {
      if (previous.group !== input.group || previous.kind !== input.kind) {
        throw new Error(
          `Assignment context source has contradictory classifications: ${path} (${previous.group}/${previous.kind} and ${input.group}/${input.kind})`
        )
      }
      continue
    }
    const exists = await fse.pathExists(input.path)
    if (!exists) {
      if (input.required) {
        throw new Error(`Required Assignment ${input.group} context is missing: ${path}`)
      }
      continue
    }
    try {
      await fse.access(input.path)
    } catch {
      if (input.required) {
        throw new Error(`Required Assignment ${input.group} context is unreadable: ${path}`)
      }
      continue
    }
    const entry = {
      identity: `${input.group}:${input.kind}:${path}`,
      group: input.group,
      kind: input.kind,
      path,
      purpose: input.purpose,
    }
    seenPaths.set(path, entry)
    entries.push(entry)
  }
  return entries.sort(
    (left, right) => GROUP_ORDER.indexOf(left.group) - GROUP_ORDER.indexOf(right.group)
  )
}

async function resolveMissionContext(targetDir, specdevPath, missionId, assignmentId) {
  const missionsDir = join(specdevPath, 'missions')
  const entries = await fse.readdir(missionsDir, { withFileTypes: true }).catch(() => [])
  const matches = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      (entry.name === missionId || entry.name.startsWith(`${String(missionId)}_`))
  )
  if (matches.length !== 1) {
    throw new Error(`Mission child references an unresolved Mission: ${missionId}`)
  }
  const missionPath = join(missionsDir, matches[0].name)
  const queuePath = join(missionPath, 'design', 'assignments.yaml')
  const queue = await readRequiredYamlLikeQueue(queuePath)
  if (
    !Array.isArray(queue.assignments) ||
    !queue.assignments.some((item) => String(item?.id) === String(assignmentId))
  ) {
    throw new Error(
      `Mission parent delegation contradicts child Assignment ${assignmentId}: ${repoRelative(targetDir, queuePath)}`
    )
  }
  const supportingPaths = Array.isArray(queue.context_paths)
    ? queue.context_paths.map(normalizeRelativePath)
    : Array.isArray(queue.knowledge_paths)
      ? queue.knowledge_paths.map((path) =>
          normalizeRelativePath(path.startsWith('.specdev/') ? path : `.specdev/${path}`)
        )
      : []
  return {
    contractPath: join(missionPath, 'brainstorm', 'contract.md'),
    queuePath,
    supportingPaths,
    targetDir,
  }
}

async function readRequiredYamlLikeQueue(path) {
  if (!(await fse.pathExists(path))) {
    throw new Error(`Required Assignment authority context is missing: ${path}`)
  }
  const { parse } = await import('yaml')
  try {
    const queue = parse(await fse.readFile(path, 'utf8'))
    if (!queue || typeof queue !== 'object') throw new Error('queue is not a mapping')
    return queue
  } catch (error) {
    throw new Error(`Required Assignment authority context is unreadable: ${error.message}`)
  }
}

async function readRequiredJson(path, purpose) {
  try {
    const value = await fse.readJson(path)
    if (!value || typeof value !== 'object') throw new Error('not an object')
    return value
  } catch (error) {
    throw new Error(`${purpose} is missing or unreadable: ${error.message}`)
  }
}

async function assignmentObjective(contractPath, fallback = '') {
  if (!(await fse.pathExists(contractPath))) return String(fallback || '').trim()
  const content = await fse.readFile(contractPath, 'utf8')
  const match = content.match(/## Objective and context\s+([\s\S]*?)(?=\n## |$)/i)
  return String(match?.[1] || fallback || '')
    .replace(/[`*_#[\]]/g, ' ')
    .trim()
}

async function freshKnowledgeResults(specdevPath, objective) {
  if (!searchTerms(objective).length) return []
  try {
    const results = await searchKnowledgeIndex(specdevPath, objective, {
      mode: 'broad',
      limit: 30,
    })
    return results
      .filter(
        (result) =>
          result.path.startsWith('knowledge/') &&
          result.freshness !== 'stale' &&
          result.freshness !== 'superseded'
      )
      .slice(0, MAX_KNOWLEDGE_RESULTS)
  } catch {
    return []
  }
}

async function relevantRoadmapDesigns(specdevPath, objective) {
  const root = join(specdevPath, 'project_notes', 'roadmap', 'designs')
  const paths = await markdownFiles(root)
  return paths
    .map((path) => ({ path, score: relevanceScore(objective, relative(root, path)) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, MAX_ROADMAP_DESIGNS)
    .map(({ path }) => path)
}

async function markdownFiles(root) {
  if (!(await fse.pathExists(root))) return []
  const found = []
  const visit = async (directory) => {
    const entries = await fse.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.endsWith('.md')) found.push(path)
    }
  }
  await visit(root)
  return found
}

function relevanceScore(objective, candidate) {
  const haystack = new Set(searchTerms(candidate))
  return searchTerms(objective).reduce((score, term) => score + Number(haystack.has(term)), 0)
}

function searchTerms(value) {
  const matches = String(value || '')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .match(/[a-z0-9][a-z0-9_-]{2,}/g)
  return [...new Set((matches || []).filter((term) => !STOP_WORDS.has(term)))].slice(0, 40)
}

function guideSearchText(guide) {
  return [guide.id, guide.summary, ...(guide.signals || [])].join(' ')
}

function findingsPath(assignmentPath, phase) {
  return join(
    assignmentPath,
    'review',
    phase.startsWith('contract') ? 'brainstorm-verdict.md' : 'implementation-verdict.md'
  )
}

function descriptor(group, kind, path, purpose, options = {}) {
  return {
    group,
    kind,
    path: resolve(path),
    purpose,
    required: options.required !== false,
  }
}

function repoRelative(targetDir, path) {
  const value = normalizeRelativePath(relative(targetDir, resolve(path)))
  if (!value || value === '..' || value.startsWith('../') || value.includes('/../')) {
    throw new Error(`Assignment context path must stay inside the repository: ${path}`)
  }
  return value
}

function normalizeRelativePath(value) {
  const normalized = String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new Error(`Invalid repository-relative context path: ${value}`)
  }
  return normalized
}
