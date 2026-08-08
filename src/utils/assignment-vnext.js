import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { getState, readCheckpoint, readCurrent as readRippleCurrent } from 'ripplegraph'
import { workflowRootFor } from './engine.js'
import { parseGitPorcelainPaths } from './workspace-changes.js'

const execFile = promisify(execFileCallback)
export const ASSIGNMENT_KINDS = Object.freeze([
  'change',
  'feature',
  'bugfix',
  'refactor',
  'documentation',
])
export const DEFAULT_REVIEW_POLICY = Object.freeze({
  brainstorm: 'optional',
  implementation: 'required',
})
const REVIEW_POLICY_VALUES = Object.freeze({
  brainstorm: new Set(['optional', 'required']),
  implementation: new Set(['required', 'waived']),
})
export const CONTRACT_SECTIONS = [
  'Objective and context',
  'Scope and non-goals',
  'Expected behavior',
  'Important decisions',
  'Constraints and invariants',
  'Delegated and reserved authority',
  'Risks and assumptions',
  'Verification authority',
  'Acceptance criteria',
]

export function assignmentContractTemplate({
  description,
  kind = 'change',
  sourceDiscussion = null,
  sourceAssignment = null,
}) {
  let source = sourceDiscussion
    ? `\nSource discussion: ${sourceDiscussion.id} (${sourceDiscussion.hash})\n${sourceDiscussion.repoPath ? `Source proposal: \`${sourceDiscussion.repoPath}/brainstorm/proposal.md\`\nSource design: \`${sourceDiscussion.repoPath}/brainstorm/design.md\`\n` : ''}`
    : ''
  const predecessor = sourceAssignment
    ? sourceAssignment.disposition === 'unsupported'
      ? `\n## Unsupported handoff (historical, not current authority)\n\n- Predecessor Assignment: ${sourceAssignment.id}\n- Unsupported closure artifact: \`${sourceAssignment.artifact}\`\n- Unsupported terminal commit: ${sourceAssignment.commit}\n- Prior objective: ${sourceAssignment.objective}\n- Unsupported conclusion: ${sourceAssignment.conclusion}\n- Historical evidence: ${sourceAssignment.evidence}\n\nThis negative finding is comparison context only. The predecessor graph, contract,\napproval, evidence, review state, and delivery authority are terminal and are not restored.\n`
      : `\n## Shelf handoff (historical, not current authority)\n\n- Predecessor Assignment: ${sourceAssignment.id}\n- Shelf artifact: \`${sourceAssignment.artifact}\`\n- Shelf Git commit: ${sourceAssignment.commit}\n- Prior objective: ${sourceAssignment.objective}\n- Prior decisions: ${sourceAssignment.decisions}\n- Completed work: ${sourceAssignment.completed}\n- Unresolved work: ${sourceAssignment.unresolved}\n- Historical verification: ${sourceAssignment.verification}\n\nThis handoff is comparison context only. The predecessor graph, approval, review\nstate, and verification authority are terminal and are not restored.\n`
    : ''
  source += predecessor
  return `# Assignment contract\n\nKind: ${kind}\n${source}\n<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->\n\n## Objective and context\n\n${description}\n\n## Scope and non-goals\n\n- In scope: TODO\n- Non-goals: TODO\n\n## Expected behavior\n\nTODO\n\n## Important decisions\n\nTODO\n\n## Constraints and invariants\n\nTODO\n\n## Delegated and reserved authority\n\n- Delegated: TODO\n- Reserved for the user: TODO\n\n## Risks and assumptions\n\nTODO\n\n## Verification authority\n\n- Focused tests for changed modules: allowed after repository instructions are satisfied\n- Full suite: requires explicit user approval unless already authorized here\n\n## Acceptance criteria\n\n- AC-1: TODO\n`
}

export function normalizeReviewPolicy(input = {}, fallback = DEFAULT_REVIEW_POLICY) {
  const policy = {
    brainstorm: String(
      input?.brainstorm || fallback.brainstorm || DEFAULT_REVIEW_POLICY.brainstorm
    ).trim(),
    implementation: String(
      input?.implementation || fallback.implementation || DEFAULT_REVIEW_POLICY.implementation
    ).trim(),
  }
  for (const [field, allowed] of Object.entries(REVIEW_POLICY_VALUES)) {
    if (!allowed.has(policy[field])) {
      throw new Error(
        `Invalid ${field} review policy: ${policy[field]}. Valid values: ${[...allowed].join(', ')}`
      )
    }
  }
  return policy
}

export function reviewPolicyFromFlags(flags = {}, fallback = DEFAULT_REVIEW_POLICY) {
  for (const name of ['brainstorm-review', 'implementation-review']) {
    if (flags[name] !== undefined && typeof flags[name] !== 'string') {
      throw new Error(`--${name} requires an explicit value`)
    }
  }
  return normalizeReviewPolicy(
    {
      brainstorm:
        typeof flags['brainstorm-review'] === 'string'
          ? flags['brainstorm-review']
          : fallback.brainstorm,
      implementation:
        typeof flags['implementation-review'] === 'string'
          ? flags['implementation-review']
          : fallback.implementation,
    },
    fallback
  )
}

export async function validateAssignmentContract(assignmentPath) {
  const path = join(assignmentPath, 'brainstorm', 'contract.md')
  return validateContractPath(path)
}

export async function validateContractPath(path) {
  if (!(await fse.pathExists(path)))
    return { valid: false, path, errors: ['brainstorm/contract.md is missing'] }
  const content = await fse.readFile(path, 'utf-8')
  const errors = []
  if (content.trim().length < 80) errors.push('contract is too short')
  for (const section of CONTRACT_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`^##\\s+${escaped}\\s*$`, 'mi').test(content)) {
      errors.push(`missing section: ## ${section}`)
    }
  }
  const acceptanceIds = [...content.matchAll(/^\s*-\s+(AC-\d+)\s*:/gim)].map((match) =>
    match[1].toUpperCase()
  )
  if (acceptanceIds.length === 0)
    errors.push('at least one acceptance criterion such as AC-1 is required')
  if (new Set(acceptanceIds).size !== acceptanceIds.length)
    errors.push('acceptance criterion IDs must be unique')
  if (/\bTODO\b/i.test(content)) errors.push('contract still contains TODO placeholders')
  return {
    valid: errors.length === 0,
    path,
    content,
    hash: hashText(content),
    acceptanceIds,
    errors,
  }
}

export function contractPreview(content) {
  const objective = firstContractParagraph(contractSection(content, 'Objective and context'))
  const scope = contractSection(content, 'Scope and non-goals')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^[-*]\s+In scope\s*:/i.test(line))
  const acceptance = contractSection(content, 'Acceptance criteria')
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^[-*]\s+(AC-\d+\s*:\s*.+)$/i)?.[1])
    .filter(Boolean)

  return [
    objective ? `Objective: ${objective}` : null,
    scope ? scope.replace(/^[-*]\s+/, '') : null,
    ...acceptance.slice(0, 2).map((criterion) => `Acceptance ${criterion}`),
  ]
    .filter(Boolean)
    .map((line) => truncateContractPreviewLine(cleanContractPreviewLine(line)))
}

function contractSection(content, heading) {
  const source = String(content || '')
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^##\\s+${escaped}\\s*$`, 'mi').exec(source)
  if (!match) return ''
  const remainder = source.slice(match.index + match[0].length).replace(/^\r?\n/, '')
  const nextHeading = /^##\s+/m.exec(remainder)
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder
}

function firstContractParagraph(section) {
  return String(section || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .find(Boolean)
}

function cleanContractPreviewLine(line) {
  return String(line || '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateContractPreviewLine(line, limit = 180) {
  if (line.length <= limit) return line
  return `${line.slice(0, limit - 3).trimEnd()}...`
}

export async function approvedContractFor(targetDir) {
  return assignmentOutputFor(targetDir, 'approve-contract')
}

export async function checkpointedContractFor(targetDir) {
  return assignmentOutputFor(targetDir, 'brainstorm')
}

function assignmentOutputFor(targetDir, nodeId) {
  const workflowRoot = workflowRootFor(targetDir)
  const focus = readRippleCurrent(workflowRoot)
  if (!focus.focusedRunId) return null
  const checkpoint = readCheckpoint(workflowRoot, focus.focusedRunId)
  const scope = checkpoint.stack.at(-1)?.scope || ''
  const key = scope ? `${scope}/${nodeId}` : nodeId
  return checkpoint.outputs[key] || null
}

export async function assertApprovedContract(targetDir, assignmentPath) {
  await assertCurrentAssignmentPath(targetDir, assignmentPath)
  const approval = await approvedContractFor(targetDir)
  if (!approval?.approved || !approval.contract_hash) {
    throw new Error('Assignment contract has not been approved')
  }
  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid)
    throw new Error(`Assignment contract is invalid: ${contract.errors.join('; ')}`)
  if (contract.hash !== approval.contract_hash) {
    throw new Error(
      'Assignment contract changed after approval; restore the approved contract or create a new Assignment for changed authority'
    )
  }
  return { contract, approval }
}

export async function currentAssignmentNode(targetDir) {
  const workflowRoot = workflowRootFor(targetDir)
  const state = getState({ workflowRoot })
  if (state.status !== 'ok' || state.position?.graph !== 'assignment-lifecycle') return null
  const focus = readRippleCurrent(workflowRoot)
  if (!focus.focusedRunId) return null
  const checkpoint = readCheckpoint(workflowRoot, focus.focusedRunId)
  const scope = state.stack?.at(-1)?.scope || ''
  const key = scope ? `${scope}/create-assignment` : 'create-assignment'
  return { ...state, assignment: checkpoint.outputs[key] || null }
}

export async function assertCurrentAssignmentPath(targetDir, assignmentPath) {
  const state = await currentAssignmentNode(targetDir)
  if (!state) throw new Error('The focused workflow is not an Assignment')
  const actual = assignmentPath.split(/[/\\]/).pop()
  if (!state.assignment?.name) {
    throw new Error('The active Assignment has no durable identity output')
  }
  if (state.assignment.name !== actual) {
    throw new Error(`The active Assignment is ${state.assignment.name}, not ${actual}`)
  }
  return state
}

export async function gitSnapshot(targetDir) {
  const [revision, branch, status] = await Promise.all([
    gitText(targetDir, ['rev-parse', 'HEAD']),
    gitText(targetDir, ['branch', '--show-current']),
    gitOutput(targetDir, ['status', '--porcelain=v1']),
  ])
  return {
    revision: revision || null,
    branch: branch || null,
    dirty_paths: parseGitPorcelainPaths(status),
  }
}

export async function writeAssignmentStatus(assignmentPath, patch) {
  const path = join(assignmentPath, 'status.json')
  const current = (await fse.pathExists(path)) ? await fse.readJson(path) : { version: 1 }
  const next = { ...current, ...patch, updated_at: new Date().toISOString() }
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, next, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
  return next
}

export async function discussionArtifactHash(discussionPath) {
  const files = ['brainstorm/proposal.md', 'brainstorm/design.md']
  const hash = createHash('sha256')
  for (const file of files) {
    const path = join(discussionPath, file)
    if (!(await fse.pathExists(path))) throw new Error(`Discussion artifact is missing: ${file}`)
    hash.update(file)
    hash.update('\0')
    hash.update(await fse.readFile(path))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function relativeToRepo(targetDir, path) {
  return relative(targetDir, path).replaceAll('\\', '/')
}

export function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function gitText(targetDir, args) {
  return (await gitOutput(targetDir, args)).trim()
}

async function gitOutput(targetDir, args) {
  try {
    const { stdout } = await execFile('git', args, { cwd: targetDir })
    return stdout
  } catch {
    return ''
  }
}
