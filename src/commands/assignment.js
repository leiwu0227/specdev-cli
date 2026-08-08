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
import { shelfAssignmentCommand, shelfAssignmentHelp } from './assignment-shelf.js'
import { closeAssignmentCommand, closeAssignmentHelp } from './assignment-close.js'
import { recoverTerminalAssignmentRuntimeResidue } from '../utils/artifact-retention.js'
import { findCommitByTrailer, gitChangedPathsAtCommit } from '../utils/git-delivery.js'
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
  if (positionalArgs[0] === 'shelf' && (flags.help || flags.h)) {
    return shelfAssignmentHelp()
  }
  if (positionalArgs[0] === 'close' && (flags.help || flags.h)) {
    return closeAssignmentHelp()
  }
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  if (positionalArgs[0] === 'shelf') {
    return shelfAssignmentCommand(targetDir, specdevPath, positionalArgs.slice(1), flags)
  }
  if (positionalArgs[0] === 'close') {
    return closeAssignmentCommand(targetDir, specdevPath, positionalArgs.slice(1), flags)
  }
  try {
    await recoverTerminalAssignmentRuntimeResidue(specdevPath)
  } catch (error) {
    return fail(flags, `Cannot recover terminal Assignment runtime residue: ${error.message}`)
  }
  const parallelMissionRoot =
    Boolean(flags['mission-root']) &&
    Boolean(flags.mission) &&
    (process.env.SPECDEV_PARALLEL_CHILD === '1' || flags['internal-mission-child'] === true)

  if (flags.id && !flags.mission) {
    return fail(
      flags,
      '--id is reserved for the Mission controller; normal Assignments allocate IDs atomically'
    )
  }

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled) {
    return fail(flags, 'big_picture.md is not filled in; run specdev start first')
  }

  const sourceSelector = flags['from-discussion'] || flags.discussion
  const testAuditSelector = flags['from-test-audit']
  const assignmentSelector = flags['from-assignment']
  if ([sourceSelector, testAuditSelector, assignmentSelector].filter(Boolean).length > 1) {
    return fail(
      flags,
      'Choose only one promotion source: --from-discussion, --from-test-audit, or --from-assignment'
    )
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
      return fail(
        flags,
        `Discussion ${discussionId} changed after completion; restore its completed artifacts or create a new Discussion`
      )
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
    if (!resolved || resolved.ambiguous)
      return fail(flags, `Test Audit not found or ambiguous: ${testAuditSelector}`)
    let call
    try {
      call = readGuidedCall(targetDir, resolved.id)
    } catch (error) {
      return fail(flags, error.message)
    }
    if (!call.synchronized || call.state.status !== 'completed') {
      return fail(flags, `Test Audit ${resolved.id} must be completed before promotion`)
    }
    const currentHash = await testAuditArtifactHash(resolved.path)
    if (!call.state.output?.artifact_hash || call.state.output.artifact_hash !== currentHash) {
      return fail(
        flags,
        `Test Audit ${resolved.id} changed after completion; restore its completed artifacts or create a new Test Audit`
      )
    }
    const contract = await validateContractPath(join(resolved.path, 'assignment-contract.md'))
    if (!contract.valid)
      return fail(flags, `Test Audit promotion contract is invalid: ${contract.errors.join('; ')}`)
    sourceTestAudit = {
      id: resolved.id,
      path: resolved.path,
      repoPath: relativeToRepo(targetDir, resolved.path),
      hash: currentHash,
      contract,
    }
  }

  let sourceAssignment = null
  if (assignmentSelector) {
    const resolved = await resolveAssignmentSelector(specdevPath, String(assignmentSelector))
    if (!resolved || resolved.ambiguous) {
      return fail(flags, `Predecessor Assignment not found or ambiguous: ${assignmentSelector}`)
    }
    const status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
    if (!['shelved', 'unsupported'].includes(status?.status)) {
      return fail(
        flags,
        `Assignment ${assignmentSelector} is not shelved or unsupported. Only an immutable terminal record can create a successor.`
      )
    }
    if (status.mission) {
      return fail(flags, `Mission child Assignment ${status.id} cannot be used as a shelf source`)
    }
    const unsupported = status.status === 'unsupported'
    const terminal = unsupported ? status.unsupported : status.shelf
    if (!terminal)
      return fail(flags, `Assignment ${status.id} has no canonical ${status.status} record`)
    if (unsupported && !Array.isArray(terminal.evidence)) {
      return fail(flags, `Unsupported closure ${status.id} has no canonical evidence manifest`)
    }
    const artifactPath = join(resolved.path, unsupported ? 'unsupported.md' : 'shelf.md')
    const expectedArtifact = relativeToRepo(targetDir, artifactPath)
    const terminalCommit = unsupported
      ? await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, { revision: 'HEAD' })
      : terminal.repository?.commit
    const terminalPaths = unsupported
      ? await gitChangedPathsAtCommit(targetDir, terminalCommit || 'missing')
      : []
    if (
      terminal.artifact !== expectedArtifact ||
      !/^[a-f0-9]{40}$/i.test(String(terminalCommit || '')) ||
      (unsupported &&
        (!terminalPaths.includes(expectedArtifact) ||
          !terminalPaths.includes(
            relativeToRepo(targetDir, join(resolved.path, 'status.json'))
          ))) ||
      !(await fse.pathExists(artifactPath))
    ) {
      return fail(
        flags,
        `${unsupported ? 'Unsupported closure' : 'Shelf'} ${status.id} is incomplete; restore its canonical artifact and terminal commit before creating a successor`
      )
    }
    const artifact = await fse.readFile(artifactPath, 'utf-8')
    sourceAssignment = unsupported
      ? {
          id: String(status.id),
          name: resolved.name,
          disposition: 'unsupported',
          artifact: expectedArtifact,
          commit: terminalCommit,
          objective: status.description,
          conclusion: status.unsupported.reason,
          evidence: status.unsupported.evidence
            .map((item) => `${item.path} (${item.digest})`)
            .join('; '),
        }
      : {
          id: String(status.id),
          name: resolved.name,
          disposition: 'shelved',
          artifact: expectedArtifact,
          commit: terminalCommit,
          objective: shelfSummary(artifact, 'Prior objective', status.description),
          decisions: shelfSummary(artifact, 'Prior decisions', 'No prior decisions recorded.'),
          completed: shelfSummary(artifact, 'Completed work', 'No completed work recorded.'),
          unresolved: shelfSummary(
            artifact,
            'Unresolved work',
            'Reassess from the current repository state.'
          ),
          verification: shelfSummary(
            artifact,
            'Historical verification',
            'No historical verification recorded.'
          ),
        }
  }

  const description =
    positionalArgs.join(' ').trim() ||
    (await descriptionFromTestAudit(sourceTestAudit)) ||
    (await descriptionFromDiscussion(sourceDiscussion)) ||
    descriptionFromAssignment(sourceAssignment)
  if (!description) {
    return fail(flags, 'No description provided. Usage: specdev assignment "Add user auth"')
  }
  const kind = String(flags.kind || flags.type || (sourceTestAudit ? 'refactor' : 'change')).trim()
  if (!ASSIGNMENT_KIND_SET.has(kind)) {
    return fail(
      flags,
      `Unknown Assignment kind: ${kind}. Valid kinds: ${[...ASSIGNMENT_KINDS].join(', ')}`
    )
  }
  let reviewPolicy
  try {
    reviewPolicy = reviewPolicyFromFlags(flags)
  } catch (error) {
    return fail(flags, error.message)
  }

  let assignmentGraph
  if (flags.mission) {
    if (parallelMissionRoot) {
      let guided
      try {
        guided = startGuidedRun(targetDir, 'assignment-lifecycle', {
          strict: true,
          expectedNode: 'create-assignment',
        })
      } catch (error) {
        return fail(flags, `Cannot create parallel Mission Assignment: ${error.message}`)
      }
      assignmentGraph = guided.state
    } else {
      const current = await currentAssignmentNode(targetDir)
      if (!current || current.position.node !== 'create-assignment') {
        return fail(
          flags,
          'Mission child creation requires the Assignment child graph at create-assignment'
        )
      }
      assignmentGraph = current
    }
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
      const recovered = await recoverPendingAssignment(
        targetDir,
        specdevPath,
        guided.state.run.id,
        flags
      )
      if (recovered) return recovered
    }
  }

  const id = flags.id ? String(flags.id) : await reserveEntityId(specdevPath, 'assignment')
  if (!/^\d{5}$/.test(id)) return fail(flags, `Invalid reserved Assignment ID: ${id}`)
  const slug = slugify(String(flags.slug || description))
  const name = `${id}_${slug}`
  const assignmentPath = join(specdevPath, 'assignments', name)
  if (await fse.pathExists(assignmentPath)) {
    return fail(
      flags,
      `Assignment folder already exists: ${relativeToRepo(targetDir, assignmentPath)}`
    )
  }
  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.writeFile(
    join(assignmentPath, 'brainstorm', 'contract.md'),
    sourceTestAudit
      ? sourceTestAudit.contract.content
      : assignmentContractTemplate({ description, kind, sourceDiscussion, sourceAssignment }),
    'utf-8'
  )
  await fse.writeFile(
    join(assignmentPath, 'outcome.md'),
    `# Outcome\n\n## Delivered behavior\n\nPending implementation.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Pending implementation evidence. | Blocked |\n`,
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
    ...(sourceAssignment
      ? {
          predecessor_assignment: {
            id: sourceAssignment.id,
            artifact: sourceAssignment.artifact,
            disposition: sourceAssignment.disposition,
            ...(sourceAssignment.disposition === 'unsupported'
              ? { closure_commit: sourceAssignment.commit }
              : { shelf_commit: sourceAssignment.commit }),
          },
        }
      : {}),
  })
  if (!flags.mission || parallelMissionRoot) {
    await writeCurrentFocus(specdevPath, { kind: 'assignment', id })
  }

  const result = {
    id,
    name,
    path: relativeToRepo(targetDir, assignmentPath),
    description,
    review_policy: reviewPolicy,
    ...(sourceAssignment
      ? {
          predecessor_assignment: {
            id: sourceAssignment.id,
            artifact: sourceAssignment.artifact,
            disposition: sourceAssignment.disposition,
            ...(sourceAssignment.disposition === 'unsupported'
              ? { closure_commit: sourceAssignment.commit }
              : { shelf_commit: sourceAssignment.commit }),
          },
        }
      : {}),
  }
  const stepped = stepGuidedNode(targetDir, 'create-assignment', result)
  if (!stepped.synchronized)
    return fail(
      flags,
      `Could not record Assignment ${id} creation; rerun the same command to recover it`
    )

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
  if (!stepped.synchronized)
    return fail(flags, `Could not recover pending Assignment ${graphOutput.id}`)
  return emitAssignment(flags, { ...graphOutput, recovered: true })
}

function emitAssignment(flags, result) {
  const payload = { command: 'assignment', version: 2, status: 'ok', ...result }
  if (flags.json) {
    console.log(JSON.stringify(payload))
  } else {
    console.log(`Assignment ${result.id}: ${result.description}`)
    console.log(`Created: ${result.path}`)
    console.log(
      `Reviews: brainstorm ${result.review_policy.brainstorm}; implementation ${result.review_policy.implementation}`
    )
    console.log(
      'Next: collaborate with the user in brainstorm/contract.md, then run specdev checkpoint brainstorm.'
    )
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
  return audit.match(/^#\s+Test Audit:\s*(.+)$/im)?.[1]?.trim() || `Apply Test Audit ${source.id}`
}

function descriptionFromAssignment(source) {
  if (!source) return ''
  return source.disposition === 'unsupported'
    ? `Reconsider unsupported Assignment ${source.id}`
    : `Continue work from shelved Assignment ${source.id}`
}

function shelfSummary(content, heading, fallback) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(content).match(
    new RegExp(`^##\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=^##\\s+|$)`, 'mi')
  )
  const value = String(match?.[1] || fallback || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replaceAll('`', "'")
  if (!value) return fallback
  return value.length > 360 ? `${value.slice(0, 357).trimEnd()}...` : value
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/g, '') || 'change'
  )
}

function fail(flags, message) {
  if (flags.json)
    console.log(
      JSON.stringify({ command: 'assignment', version: 2, status: 'error', error: message })
    )
  else console.error(message)
  process.exitCode = 1
  return null
}
