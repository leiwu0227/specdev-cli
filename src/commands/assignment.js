import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { readCurrentFocus, writeCurrentFocus } from '../utils/current.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { startGuidedRun, stepGuidedNode } from '../utils/engine-sync.js'
import { reserveEntityId } from '../utils/id-reservation.js'
import { readGuidedCall } from '../utils/callable-sync.js'
import { resolveTestAuditSelector, testAuditArtifactHash } from '../utils/test-audit.js'
import {
  ASSIGNMENT_KINDS,
  assignmentContractTemplate,
  currentAssignmentNode,
  discussionArtifactHash,
  relativeToRepo,
  reviewPolicyFromFlags,
  validateContractPath,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'

const ASSIGNMENT_KIND_SET = new Set(ASSIGNMENT_KINDS)

export async function assignmentCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.id && !flags.mission) {
    return fail(flags, '--id is reserved for the Mission controller; normal Assignments allocate IDs atomically')
  }

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled) {
    return fail(flags, 'big_picture.md is not filled in; run specdev start first')
  }

  const sourceSelector = flags['from-discussion'] || flags.discussion
  const testAuditSelector = flags['from-test-audit']
  if (sourceSelector && testAuditSelector) {
    return fail(flags, 'Choose only one promotion source: --from-discussion or --from-test-audit')
  }
  let sourceDiscussion = null
  if (sourceSelector) {
    const resolved = await resolveDiscussionSelector(specdevPath, String(sourceSelector))
    if (!resolved || resolved.error) return fail(flags, `Discussion not found: ${sourceSelector}`)
    const discussionId = resolved.name.match(/^D\d{4,5}/)?.[0]
    let call
    try {
      call = readGuidedCall(targetDir, discussionId)
    } catch (error) {
      return fail(flags, error.message)
    }
    if (!call.synchronized || call.state.status !== 'completed') {
      return fail(flags, `Discussion ${discussionId} must be completed before promotion`)
    }
    const completedHash = call.state.output?.artifact_hash
    const currentHash = await discussionArtifactHash(resolved.path)
    if (!completedHash || completedHash !== currentHash) {
      return fail(flags, `Discussion ${discussionId} changed after completion; restore its completed artifacts or create a new Discussion`)
    }
    sourceDiscussion = {
      id: discussionId,
      name: resolved.name,
      path: resolved.path,
      repoPath: relativeToRepo(targetDir, resolved.path),
      hash: currentHash,
    }
  }

  let sourceTestAudit = null
  if (testAuditSelector) {
    const resolved = await resolveTestAuditSelector(specdevPath, String(testAuditSelector))
    if (!resolved || resolved.ambiguous) return fail(flags, `Test Audit not found or ambiguous: ${testAuditSelector}`)
    let call
    try { call = readGuidedCall(targetDir, resolved.id) } catch (error) { return fail(flags, error.message) }
    if (!call.synchronized || call.state.status !== 'completed') {
      return fail(flags, `Test Audit ${resolved.id} must be completed before promotion`)
    }
    const currentHash = await testAuditArtifactHash(resolved.path)
    if (!call.state.output?.artifact_hash || call.state.output.artifact_hash !== currentHash) {
      return fail(flags, `Test Audit ${resolved.id} changed after completion; restore its completed artifacts or create a new Test Audit`)
    }
    const contract = await validateContractPath(join(resolved.path, 'assignment-contract.md'))
    if (!contract.valid) return fail(flags, `Test Audit promotion contract is invalid: ${contract.errors.join('; ')}`)
    sourceTestAudit = {
      id: resolved.id,
      path: resolved.path,
      repoPath: relativeToRepo(targetDir, resolved.path),
      hash: currentHash,
      contract,
    }
  }

  const description = positionalArgs.join(' ').trim() ||
    await descriptionFromTestAudit(sourceTestAudit) ||
    await descriptionFromDiscussion(sourceDiscussion)
  if (!description) {
    return fail(flags, 'No description provided. Usage: specdev assignment "Add user auth"')
  }
  const kind = String(flags.kind || flags.type || (sourceTestAudit ? 'refactor' : 'change')).trim()
  if (!ASSIGNMENT_KIND_SET.has(kind)) {
    return fail(flags, `Unknown Assignment kind: ${kind}. Valid kinds: ${[...ASSIGNMENT_KINDS].join(', ')}`)
  }
  let reviewPolicy
  try {
    reviewPolicy = reviewPolicyFromFlags(flags)
  } catch (error) {
    return fail(flags, error.message)
  }

  let assignmentGraph
  if (flags.mission) {
    const current = await currentAssignmentNode(targetDir)
    if (!current || current.position.node !== 'create-assignment') {
      return fail(flags, 'Mission child creation requires the Assignment child graph at create-assignment')
    }
    assignmentGraph = current
  } else {
    let guided
    try {
      guided = startGuidedRun(targetDir, 'assignment-lifecycle', {
        strict: true,
        expectedNode: 'create-assignment',
      })
    } catch (error) {
      return fail(flags, `Cannot create Assignment: ${error.message}`)
    }
    assignmentGraph = guided.state
    if (!guided.started) {
      const recovered = await recoverPendingAssignment(targetDir, specdevPath, guided.state.run.id, flags)
      if (recovered) return recovered
    }
  }

  const id = flags.id ? String(flags.id) : await reserveEntityId(specdevPath, 'assignment')
  if (!/^\d{5}$/.test(id)) return fail(flags, `Invalid reserved Assignment ID: ${id}`)
  const slug = slugify(String(flags.slug || description))
  const name = `${id}_${slug}`
  const assignmentPath = join(specdevPath, 'assignments', name)
  if (await fse.pathExists(assignmentPath)) {
    return fail(flags, `Assignment folder already exists: ${relativeToRepo(targetDir, assignmentPath)}`)
  }
  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.writeFile(
    join(assignmentPath, 'brainstorm', 'contract.md'),
    sourceTestAudit
      ? sourceTestAudit.contract.content
      : assignmentContractTemplate({ description, kind, sourceDiscussion }),
    'utf-8'
  )
  await writeAssignmentStatus(assignmentPath, {
    id,
    kind,
    description,
    run_id: assignmentGraph.run.id,
    created_at: new Date().toISOString(),
    review_policy: reviewPolicy,
    ...(flags.mission ? { mission: String(flags.mission) } : {}),
    ...(sourceDiscussion
      ? { source_discussion: { id: sourceDiscussion.id, hash: sourceDiscussion.hash } }
      : {}),
    ...(sourceTestAudit
      ? { source_test_audit: { id: sourceTestAudit.id, hash: sourceTestAudit.hash } }
      : {}),
  })
  if (!flags.mission) await writeCurrentFocus(specdevPath, { kind: 'assignment', id })

  const result = {
    id,
    name,
    path: relativeToRepo(targetDir, assignmentPath),
    description,
    review_policy: reviewPolicy,
  }
  const stepped = stepGuidedNode(targetDir, 'create-assignment', result)
  if (!stepped.synchronized) return fail(flags, `Could not record Assignment ${id} creation; rerun the same command to recover it`)

  return emitAssignment(flags, result)
}

async function recoverPendingAssignment(targetDir, specdevPath, runId, flags) {
  const focus = await readCurrentFocus(specdevPath)
  if (focus?.kind !== 'assignment') return null
  const resolved = await resolveAssignmentSelector(specdevPath, focus.id)
  if (!resolved || resolved.ambiguous) return null
  const status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
  if (status?.run_id !== runId || !status.id || !status.description) return null
  const graphOutput = {
    id: String(status.id),
    name: resolved.name,
    path: relativeToRepo(targetDir, resolved.path),
    description: String(status.description),
    review_policy: reviewPolicyFromFlags({}, status.review_policy),
  }
  const stepped = stepGuidedNode(targetDir, 'create-assignment', graphOutput)
  if (!stepped.synchronized) return fail(flags, `Could not recover pending Assignment ${graphOutput.id}`)
  return emitAssignment(flags, { ...graphOutput, recovered: true })
}

function emitAssignment(flags, result) {
  const payload = { command: 'assignment', version: 2, status: 'ok', ...result }
  if (flags.json) {
    console.log(JSON.stringify(payload))
  } else {
    console.log(`Assignment ${result.id}: ${result.description}`)
    console.log(`Created: ${result.path}`)
    console.log(`Reviews: brainstorm ${result.review_policy.brainstorm}; implementation ${result.review_policy.implementation}`)
    console.log('Next: collaborate with the user in brainstorm/contract.md, then run specdev checkpoint brainstorm.')
  }
  return payload
}

async function descriptionFromDiscussion(source) {
  if (!source) return ''
  const proposalPath = join(source.path, 'brainstorm', 'proposal.md')
  if (!(await fse.pathExists(proposalPath))) return `Promote discussion ${source.id}`
  const content = await fse.readFile(proposalPath, 'utf-8')
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || `Promote discussion ${source.id}`
}

async function descriptionFromTestAudit(source) {
  if (!source) return ''
  const audit = await fse.readFile(join(source.path, 'audit.md'), 'utf-8')
  return audit.match(/^#\s+Test Audit:\s*(.+)$/mi)?.[1]?.trim() || `Apply Test Audit ${source.id}`
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '') || 'change'
}

function fail(flags, message) {
  if (flags.json) console.log(JSON.stringify({ command: 'assignment', version: 2, status: 'error', error: message }))
  else console.error(message)
  process.exitCode = 1
  return null
}
