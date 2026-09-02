import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import {
  abandonRun,
  readCheckpoint,
  readCurrent as readRippleCurrent,
  resumeRun,
  runDir,
} from 'ripplegraph'
import { parse as parseYaml } from 'yaml'
import { relativeToRepo } from '../utils/assignment-vnext.js'
import { compactAbandonedMissionWorkflowRuntime } from '../utils/artifact-retention.js'
import { readCurrentFocus } from '../utils/current.js'
import {
  commitExactDelivery,
  currentGitBranch,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusEntries,
  requireGitHead,
  synchronizeIndexPaths,
} from '../utils/git-delivery.js'
import { readMissionQueue, writeMission } from '../utils/mission.js'
import { listMissionWorktrees } from '../utils/mission-worktrees.js'
import {
  attemptActivitySummary,
  attemptLiveness,
  listAttemptRecords,
  updateAttemptRecord,
} from '../utils/process-record.js'

const execFile = promisify(execFileCallback)
const JOURNAL_VERSION = 1
const COMMIT_TYPE = 'abandonment'
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'abandoned'])

export async function abandonMissionCommand(context, flags = {}) {
  const { targetDir, specdevPath, missionPath, mission } = context
  let reason
  try {
    reason = requiredReason(flags.reason)
  } catch (error) {
    return failure(error.message)
  }
  if (!reason) return failure('Mission abandonment requires --reason="<reason>"')

  const journalPath = abandonmentJournalPath(specdevPath, mission.id)
  const journal = await readJson(journalPath)
  if (mission.status === 'abandoned') {
    try {
      assertExactRetry(mission, reason, flags.confirm)
      return success(await recoverAbandonment(context, journal, true), flags)
    } catch (error) {
      return failure(
        `Could not recover Mission abandonment: ${error.message}\nRerun: ${recoveryCommand(mission.id, reason, mission.abandonment?.plan_digest)}`
      )
    }
  }
  if (TERMINAL_STATUSES.has(mission.status)) {
    return failure(`Mission ${mission.id} is already ${mission.status} and is immutable`)
  }

  let plan
  try {
    plan = await buildAbandonmentPlan(context, reason)
  } catch (error) {
    return failure(error.message)
  }

  const confirmation = typeof flags.confirm === 'string' ? flags.confirm.trim() : ''
  if (!confirmation) return planned(plan, flags)
  if (!/^[a-f0-9]{64}$/.test(confirmation)) {
    return failure('--confirm requires the exact 64-character abandonment plan digest')
  }
  if (confirmation !== plan.digest) {
    return changedPlan(plan, flags)
  }

  try {
    await writeJournal(journalPath, {
      version: JOURNAL_VERSION,
      phase: 'authority_confirmed',
      plan,
      confirmed_at: new Date().toISOString(),
    })
    if (flags['interrupt-after'] === 'authority-confirmed') {
      throw new Error('simulated interruption after abandonment authority confirmation')
    }
    await prepareAbandonment(context, plan, journalPath, {
      revalidate: true,
      interruptAfter: flags['interrupt-after'],
    })
    if (flags['interrupt-after'] === 'prepared') {
      throw new Error('simulated interruption after abandonment preparation')
    }
    return success(await publishAbandonment(context, plan, journalPath, false), flags)
  } catch (error) {
    return failure(
      `Mission abandonment did not publish: ${error.message}\nRerun: ${recoveryCommand(mission.id, reason, plan.digest)}`
    )
  }

  function failure(message) {
    if (flags.json) {
      console.log(
        JSON.stringify({ command: 'mission abandon', version: 1, status: 'error', error: message })
      )
    } else console.error(message)
    process.exitCode = 1
    return null
  }
}

export async function inspectAbandonedMission(targetDir, mission) {
  if (mission.status !== 'abandoned') return null
  const terminalCommit = mission.abandonment?.plan_digest
    ? await findCommitByTrailer(
        targetDir,
        'SpecDev-Abandonment-Plan',
        mission.abandonment.plan_digest,
        { revision: mission.branch || 'HEAD' }
      )
    : null
  return {
    status: 'abandoned',
    reason: mission.abandonment?.reason || mission.abandon_reason || null,
    abandoned_at: mission.abandoned_at || null,
    artifact: mission.abandonment?.artifact || null,
    retained: mission.abandonment?.retained || null,
    plan_digest: mission.abandonment?.plan_digest || null,
    terminal_commit: terminalCommit,
    delivery: null,
  }
}

export function abandonedMissionError(mission, operation) {
  if (mission.status !== 'abandoned') return null
  return `Mission ${mission.id} is abandoned and immutable; ${operation} cannot reinterpret or mutate it`
}

async function buildAbandonmentPlan(context, reason) {
  const { targetDir, specdevPath, missionPath, mission } = context
  if (!mission.id || !mission.run_id || !mission.branch) {
    throw new Error('Mission has no complete durable lifecycle and branch identity')
  }
  const checkpoint = readCheckpoint(specdevPath, mission.run_id)
  if (
    checkpoint.rootGraph !== 'mission-lifecycle' ||
    !['active', 'suspended'].includes(checkpoint.status)
  ) {
    throw new Error(
      `Mission ${mission.id} does not have an eligible nonterminal lifecycle run (${checkpoint.status})`
    )
  }
  const rippleFocus = readRippleCurrent(specdevPath)
  if (
    (checkpoint.status === 'active' && rippleFocus.focusedRunId !== mission.run_id) ||
    (checkpoint.status === 'suspended' && rippleFocus.focusedRunId)
  ) {
    throw new Error(
      `Mission run/focus mismatch: run is ${checkpoint.status}, focus is ${rippleFocus.focusedRunId || 'none'}`
    )
  }
  const focus = await readCurrentFocus(specdevPath)
  if (focus?.kind !== 'mission' || focus.id !== mission.id) {
    throw new Error(`Mission ${mission.id} is not the active SpecDev focus`)
  }

  const attempts = await inspectMissionAttempts(specdevPath, mission.id)
  if (attempts.blocking.length > 0) {
    throw new Error(
      `Mission ${mission.id} has live or ambiguous Attempts: ${attempts.blocking.join(', ')}. Stop or resolve them before abandonment.`
    )
  }

  const head = await requireGitHead(targetDir)
  const branch = await currentGitBranch(targetDir)
  const missionRevision = await branchRevision(targetDir, mission.branch)
  if (branch !== mission.branch || missionRevision !== head) {
    throw new Error(
      `Mission abandonment requires checked-out branch ${mission.branch} at its HEAD; current branch is ${branch || 'detached'}`
    )
  }
  const dirty = await gitStatusEntries(targetDir)
  if (dirty.length > 0) {
    throw new Error(
      `Mission abandonment requires a clean main worktree; resolve: ${dirty.map((item) => item.path).join(', ')}`
    )
  }

  const queuePath = join(missionPath, 'design', 'assignments.yaml')
  const queue = (await fse.pathExists(queuePath))
    ? await readMissionQueue(missionPath)
    : { assignments: [] }
  if (!Array.isArray(queue?.assignments)) {
    throw new Error('Mission queue is malformed and cannot be bound to abandonment authority')
  }
  const children = await inspectChildBranches(targetDir, mission, queue)
  const worktrees = await inspectChildWorktrees(targetDir, specdevPath, mission, queue)
  const baseRevision = mission.base_branch
    ? await branchRevision(targetDir, mission.base_branch)
    : mission.base_revision || null
  if (mission.base_branch && !baseRevision) {
    throw new Error(`Mission base branch is missing: ${mission.base_branch}`)
  }
  const missionPathRelative = relativeToRepo(targetDir, missionPath)
  const terminalPaths = await prospectiveTerminalPaths(
    targetDir,
    specdevPath,
    missionPathRelative,
    mission,
    checkpoint,
    attempts.records
  )
  const planFacts = {
    version: 1,
    operation: 'mission-abandon',
    mission: {
      id: mission.id,
      path: missionPathRelative,
      status: mission.status,
      run_id: mission.run_id,
      branch: mission.branch,
      head,
      base_branch: mission.base_branch || null,
      base_revision: baseRevision || mission.base_revision || null,
    },
    reason,
    focus: { specdev: focus, ripplegraph: rippleFocus.focusedRunId || null },
    checkpoint: {
      status: checkpoint.status,
      position: checkpoint.position,
      digest: await fileDigest(join(runDir(specdevPath, mission.run_id), 'checkpoint.json')),
    },
    records: {
      mission_digest: await fileDigest(join(missionPath, 'mission.yaml')),
      queue_digest: await optionalFileDigest(queuePath),
      attempts: attempts.facts,
    },
    retained: {
      mission_branch: { name: mission.branch, revision: head },
      base_branch: { name: mission.base_branch || null, revision: baseRevision || null },
      child_branches: children,
      child_worktrees: worktrees,
    },
    terminal: {
      artifact: `${missionPathRelative}/abandoned.md`,
      status: `${missionPathRelative}/status.json`,
      paths: terminalPaths,
      commit_subject: `specdev(mission): abandon ${mission.id}`,
      commit_type: COMMIT_TYPE,
      delivery: null,
    },
  }
  return { ...planFacts, digest: digest(planFacts) }
}

async function inspectMissionAttempts(specdevPath, missionId) {
  const records = await listAttemptRecords(specdevPath, { mission: missionId })
  const blocking = []
  const stale = []
  const facts = []
  for (const record of records) {
    let liveness = null
    if (record.status === 'running') {
      liveness = await attemptLiveness(specdevPath, record.id)
      if (liveness.state === 'stale') stale.push(record.id)
      else blocking.push(`${record.id} (${liveness.state})`)
    }
    facts.push({
      id: record.id,
      kind: record.kind || null,
      status: record.status,
      assignment: record.assignment || null,
      workspace: record.workspace || null,
      liveness: liveness?.state || null,
      record_digest: await fileDigest(join(specdevPath, 'processes', `${record.id}.yaml`)),
    })
  }
  return { records, facts, blocking, stale }
}

async function inspectChildBranches(targetDir, mission, queue) {
  const children = []
  for (const child of queue.assignments || []) {
    if (!child.branch) continue
    const revision = await branchRevision(targetDir, child.branch)
    if (!revision) {
      const retainedRevision = child.integration_revision || child.delivery_revision || null
      if (
        !['completed', 'integrated'].includes(child.status) ||
        !retainedRevision ||
        !(await gitObjectExists(targetDir, retainedRevision))
      ) {
        throw new Error(
          `Mission child branch is missing without retained delivery: ${child.branch}`
        )
      }
      children.push({
        assignment: child.id,
        status: child.status,
        branch: child.branch,
        revision: retainedRevision,
        branch_present: false,
        integration_revision: child.integration_revision || null,
        delivery_revision: child.delivery_revision || null,
      })
      continue
    }
    const baseRevision = child.base_revision || mission.base_revision
    if (baseRevision && !(await isAncestor(targetDir, baseRevision, revision))) {
      throw new Error(`Mission child branch is not attributable to its base: ${child.branch}`)
    }
    children.push({
      assignment: child.id,
      status: child.status,
      branch: child.branch,
      revision,
      branch_present: true,
    })
  }
  return children.sort((left, right) => left.assignment.localeCompare(right.assignment))
}

async function inspectChildWorktrees(targetDir, specdevPath, mission, queue) {
  const registered = await listMissionWorktrees(targetDir, specdevPath)
  await assertNoUnregisteredPoolEntries(specdevPath, registered)
  const byBranch = new Map(
    (queue.assignments || []).filter((child) => child.branch).map((child) => [child.branch, child])
  )
  const result = []
  for (const item of registered) {
    const child = byBranch.get(item.branch)
    if (!child) {
      throw new Error(
        `Registered worktree ${relativeToRepo(targetDir, item.worktree)} is not attributable to Mission ${mission.id}`
      )
    }
    const entries = await gitStatusEntries(item.worktree)
    if (entries.length > 0) {
      throw new Error(
        `Mission child worktree ${relativeToRepo(targetDir, item.worktree)} is dirty: ${entries.map((entry) => entry.path).join(', ')}`
      )
    }
    const branch = await currentGitBranch(item.worktree)
    const head = await requireGitHead(item.worktree)
    if (branch !== item.branch || head !== item.revision) {
      throw new Error(
        `Mission child worktree ${relativeToRepo(targetDir, item.worktree)} changed branch or HEAD`
      )
    }
    result.push({
      assignment: child.id,
      path: relativeToRepo(targetDir, item.worktree),
      branch: item.branch,
      revision: item.revision,
    })
  }
  return result.sort((left, right) => left.path.localeCompare(right.path))
}

async function assertNoUnregisteredPoolEntries(specdevPath, registered) {
  const pool = resolve(specdevPath, 'worktrees')
  if (!(await fse.pathExists(pool))) return
  const registeredPaths = new Set(registered.map((item) => resolve(item.worktree)))
  for (const entry of await fse.readdir(pool, { withFileTypes: true })) {
    const path = resolve(pool, entry.name)
    if (registeredPaths.has(path)) continue
    if (!entry.isDirectory()) throw new Error(`Unregistered Mission worktree entry: ${entry.name}`)
    const contents = await fse.readdir(path)
    if (contents.length > 0)
      throw new Error(`Unregistered Mission worktree directory: ${entry.name}`)
  }
}

async function prospectiveTerminalPaths(
  targetDir,
  specdevPath,
  missionPath,
  mission,
  checkpoint,
  attempts
) {
  const candidates = [
    `${missionPath}/mission.yaml`,
    `${missionPath}/status.json`,
    `${missionPath}/abandoned.md`,
    relativeToRepo(targetDir, runDir(specdevPath, mission.run_id)),
    ...attempts.map((attempt) => `.specdev/processes/${attempt.id}.yaml`),
    '.specdev/.current',
    ...(checkpoint.status === 'active' ? ['.specdev/.ripplegraph/current.json'] : []),
  ]
  const paths = new Set([
    `${missionPath}/mission.yaml`,
    `${missionPath}/status.json`,
    `${missionPath}/abandoned.md`,
  ])
  for (const candidate of candidates) {
    const tracked = await gitText(targetDir, ['ls-files', '-z', '--', candidate])
    for (const path of tracked.split('\0').filter(Boolean)) paths.add(path)
  }
  return [...paths].sort()
}

async function prepareAbandonment(
  context,
  plan,
  journalPath,
  { revalidate = false, interruptAfter = null } = {}
) {
  const { targetDir, specdevPath, missionPath, mission } = context
  if (mission.status === 'abandoned') {
    if (mission.abandonment?.plan_digest !== plan.digest) {
      throw new Error('prepared abandonment disagrees with confirmed authority')
    }
  } else if (revalidate) {
    const currentPlan = await buildAbandonmentPlan(context, plan.reason)
    if (currentPlan.digest !== plan.digest) throw new Error('confirmed abandonment state changed')
  }
  await writeJournal(journalPath, {
    version: JOURNAL_VERSION,
    phase: 'preparing',
    plan,
    preparing_at: new Date().toISOString(),
  })

  for (const fact of plan.records.attempts.filter(
    (attempt) => attempt.status === 'running' && attempt.liveness === 'stale'
  )) {
    if (!(await fse.pathExists(join(specdevPath, 'processes', `${fact.id}.yaml`)))) continue
    await updateAttemptRecord(specdevPath, fact.id, {
      status: 'interrupted',
      error: 'Mission abandoned after stale-process preflight',
    })
  }

  const abandonedAt = mission.abandoned_at || new Date().toISOString()
  const activity =
    mission.activity ||
    (await attemptActivitySummary(
      specdevPath,
      { mission: mission.id },
      { startedAt: mission.approved_at || mission.created_at, endedAt: abandonedAt }
    ))
  const abandonment = {
    version: 1,
    disposition: 'abandoned',
    reason: plan.reason,
    abandoned_at: abandonedAt,
    artifact: plan.terminal.artifact,
    plan_digest: plan.digest,
    retained: plan.retained,
    source_lifecycle: {
      status: plan.mission.status,
      run_id: plan.mission.run_id,
      run_status: plan.checkpoint.status,
      position: plan.checkpoint.position,
    },
    repository: { parent: plan.mission.head, branch: plan.mission.branch },
    delivery: null,
    plan,
  }
  await fse.writeFile(
    join(missionPath, 'abandoned.md'),
    renderArtifact(mission, abandonment),
    'utf8'
  )
  mission.status = 'abandoned'
  mission.disposition = 'abandoned'
  mission.abandoned_at = abandonedAt
  mission.abandon_reason = plan.reason
  mission.abandonment = abandonment
  mission.activity = activity
  mission.next_action = null
  delete mission.blocker
  delete mission.final_revision
  delete mission.final_dirty_paths
  await writeMission(missionPath, mission)
  await writeJsonAtomic(join(missionPath, 'status.json'), {
    version: 1,
    status: 'abandoned',
    disposition: 'abandoned',
    abandoned_at: abandonedAt,
    reason: plan.reason,
    artifact: plan.terminal.artifact,
    plan_digest: plan.digest,
    retained: plan.retained,
    delivery: null,
  })
  if (interruptAfter === 'terminal-written') {
    throw new Error('simulated interruption after writing abandonment records')
  }

  if (await fse.pathExists(join(runDir(specdevPath, mission.run_id), 'checkpoint.json'))) {
    const checkpoint = readCheckpoint(specdevPath, mission.run_id)
    if (checkpoint.status === 'suspended') {
      resumeRun({ workflowRoot: specdevPath, runId: mission.run_id })
    }
    const active = readCheckpoint(specdevPath, mission.run_id)
    if (active.status === 'active') {
      abandonRun({
        workflowRoot: specdevPath,
        reason: `Mission ${mission.id} abandoned: ${plan.reason}`,
      })
    } else if (active.status !== 'abandoned') {
      throw new Error(`abandonment conflicts with run state ${active.status}`)
    }
  }
  await compactAbandonedMissionWorkflowRuntime(specdevPath, {
    runId: mission.run_id,
    attemptFilter: { mission: mission.id },
    terminalOwner: { mission: mission.id, status: 'abandoned' },
    focus: { kind: 'mission', id: mission.id },
  })

  const preparedPaths = await assertPreparedPaths(targetDir, plan)
  await writeJournal(journalPath, {
    version: JOURNAL_VERSION,
    phase: 'prepared',
    plan,
    prepared_at: new Date().toISOString(),
    prepared_paths: preparedPaths,
  })
}

async function publishAbandonment(context, plan, journalPath, idempotent) {
  const { targetDir, specdevPath, missionPath, mission } = context
  let terminalCommit = await findCommitByTrailer(
    targetDir,
    'SpecDev-Abandonment-Plan',
    plan.digest,
    { revision: 'HEAD' }
  )
  if (terminalCommit) {
    const message = await gitText(targetDir, ['show', '-s', '--format=%B', terminalCommit])
    if (!message.split(/\r?\n/).includes(`SpecDev-Commit-Type: ${COMMIT_TYPE}`)) {
      terminalCommit = null
    }
  }
  if (!terminalCommit) {
    if ((await requireGitHead(targetDir)) !== plan.mission.head) {
      throw new Error('HEAD no longer matches the confirmed Mission revision')
    }
    const preparedPaths = await assertPreparedPaths(targetDir, plan)
    const delivery = await commitExactDelivery(targetDir, {
      expectedHead: plan.mission.head,
      paths: preparedPaths,
      subject: plan.terminal.commit_subject,
      trailers: {
        'SpecDev-Mission': mission.id,
        'SpecDev-Commit-Type': COMMIT_TYPE,
        'SpecDev-Disposition': 'abandoned',
        'SpecDev-Abandonment-Plan': plan.digest,
      },
      finalizeDraft: async ({ commit, committedPaths }) => {
        assertSamePaths(committedPaths, preparedPaths, 'Abandonment draft commit')
        const current = (await readJson(journalPath)) || {}
        await writeJournal(journalPath, { ...current, draft_commit: commit })
      },
    })
    terminalCommit = delivery.commit
  } else {
    if ((await requireGitHead(targetDir)) === terminalCommit) {
      await synchronizeIndexPaths(targetDir, plan.terminal.paths, terminalCommit)
    }
  }
  const verification = await verifyAbandonmentCommit(context, plan, terminalCommit)
  await writeJournal(journalPath, {
    version: JOURNAL_VERSION,
    phase: 'published',
    plan,
    terminal_commit: terminalCommit,
    published_at: new Date().toISOString(),
    verification,
  })
  return {
    command: 'mission abandon',
    version: 1,
    status: 'abandoned',
    disposition: 'abandoned',
    mission: mission.id,
    reason: plan.reason,
    abandoned_at: mission.abandoned_at,
    artifact: relativeToRepo(targetDir, join(missionPath, 'abandoned.md')),
    plan_digest: plan.digest,
    retained: plan.retained,
    repository: {
      parent: plan.mission.head,
      terminal_commit: terminalCommit,
      committed_paths: verification.committed_paths,
    },
    runtime_compaction: { compacted: true, run_id: mission.run_id },
    delivery: null,
    landing: null,
    idempotent,
    next_action: `Inspect retained work with specdev mission status ${mission.id}.`,
  }
}

async function recoverAbandonment(context, journal, idempotent) {
  const plan = journal?.plan || context.mission.abandonment?.plan
  if (!plan || plan.digest !== context.mission.abandonment?.plan_digest) {
    throw new Error('durable abandonment authority is missing or inconsistent')
  }
  const { digest: recordedDigest, ...facts } = plan
  if (digest(facts) !== recordedDigest) throw new Error('abandonment plan digest is invalid')
  const existing = await findCommitByTrailer(
    context.targetDir,
    'SpecDev-Abandonment-Plan',
    plan.digest,
    { revision: 'HEAD' }
  )
  if (existing)
    return publishAbandonment(
      context,
      plan,
      abandonmentJournalPath(context.specdevPath, context.mission.id),
      idempotent
    )
  if (!['authority_confirmed', 'preparing', 'prepared'].includes(journal?.phase)) {
    throw new Error(
      `abandonment journal is ${journal?.phase || 'invalid'} but no terminal commit exists`
    )
  }
  if (journal.phase !== 'prepared') {
    await prepareAbandonment(
      context,
      plan,
      abandonmentJournalPath(context.specdevPath, context.mission.id),
      {
        revalidate:
          journal.phase === 'authority_confirmed' && context.mission.status !== 'abandoned',
      }
    )
  }
  return publishAbandonment(
    context,
    plan,
    abandonmentJournalPath(context.specdevPath, context.mission.id),
    idempotent
  )
}

async function verifyAbandonmentCommit(context, plan, commit) {
  const { targetDir, specdevPath, missionPath, mission } = context
  if ((await firstParent(targetDir, commit)) !== plan.mission.head) {
    throw new Error('abandonment commit parent does not match the confirmed HEAD')
  }
  const committedPaths = await gitChangedPathsAtCommit(targetDir, commit)
  assertSamePaths(committedPaths, plan.terminal.paths, 'Abandonment commit path set')
  const message = await gitText(targetDir, ['show', '-s', '--format=%B', commit])
  for (const trailer of [
    `SpecDev-Mission: ${mission.id}`,
    `SpecDev-Commit-Type: ${COMMIT_TYPE}`,
    'SpecDev-Disposition: abandoned',
    `SpecDev-Abandonment-Plan: ${plan.digest}`,
  ]) {
    if (!message.split(/\r?\n/).includes(trailer)) {
      throw new Error(`abandonment commit is missing trailer ${trailer}`)
    }
  }
  const missionRepoPath = relativeToRepo(targetDir, join(missionPath, 'mission.yaml'))
  const committedMission = parseYaml(
    await gitTextStrict(targetDir, ['show', `${commit}:${missionRepoPath}`])
  )
  if (
    committedMission?.status !== 'abandoned' ||
    committedMission?.abandonment?.plan_digest !== plan.digest
  ) {
    throw new Error('committed Mission record disagrees with the abandonment plan')
  }
  const artifact = await gitTextStrict(targetDir, ['show', `${commit}:${plan.terminal.artifact}`])
  for (const fact of [plan.digest, plan.reason, plan.mission.head]) {
    if (!artifact.includes(fact)) throw new Error('committed abandonment artifact is incomplete')
  }
  if (await fse.pathExists(runDir(specdevPath, mission.run_id))) {
    throw new Error('Mission runtime still exists after abandonment')
  }
  const focus = await readCurrentFocus(specdevPath)
  if (focus?.kind === 'mission' && focus.id === mission.id) {
    throw new Error('abandoned Mission remains the active focus')
  }
  const dirty = await gitStatusEntries(targetDir)
  if (dirty.length > 0) {
    throw new Error(
      `abandoned Mission repository state changed after publication: ${dirty.map((item) => item.path).join(', ')}`
    )
  }
  return { committed_paths: committedPaths, runtime_compacted: true, focus_cleared: true }
}

async function assertPreparedPaths(targetDir, plan) {
  if ((await requireGitHead(targetDir)) !== plan.mission.head) {
    throw new Error('HEAD changed after abandonment confirmation')
  }
  const paths = (await gitStatusEntries(targetDir)).map((entry) => entry.path).sort()
  assertSamePaths(paths, plan.terminal.paths, 'Prepared abandonment path set')
  return paths
}

function renderArtifact(mission, abandonment) {
  const branches = [
    `- Mission: \`${abandonment.retained.mission_branch.name}\` at \`${abandonment.retained.mission_branch.revision}\``,
    `- Base: ${abandonment.retained.base_branch.name ? `\`${abandonment.retained.base_branch.name}\` at \`${abandonment.retained.base_branch.revision || 'missing'}\`` : 'none recorded'}`,
    ...abandonment.retained.child_branches.map((child) =>
      child.branch_present
        ? `- Child ${child.assignment}: \`${child.branch}\` at \`${child.revision}\` (${child.status})`
        : `- Child ${child.assignment}: removed integrated branch \`${child.branch}\`; retained commit \`${child.revision}\` (${child.status})`
    ),
  ]
  const worktrees = abandonment.retained.child_worktrees.length
    ? abandonment.retained.child_worktrees.map(
        (item) =>
          `- Child ${item.assignment}: \`${item.path}\` on \`${item.branch}\` at \`${item.revision}\``
      )
    : ['- None registered']
  return `# Abandoned Mission\n\n- Mission: ${mission.id}\n- Disposition: abandoned (terminal and immutable)\n- Abandoned at: ${abandonment.abandoned_at}\n- Reason: ${abandonment.reason}\n- Prior lifecycle: ${abandonment.source_lifecycle.status} (run ${abandonment.source_lifecycle.run_id}; ${abandonment.source_lifecycle.run_status})\n- Plan digest: \`${abandonment.plan_digest}\`\n- Delivery: none\n\n## Retained Git identities\n\n${branches.join('\n')}\n\n## Retained child worktrees\n\n${worktrees.join('\n')}\n\n## Terminal result\n\nNo partial work was landed, merged, deleted, or reinterpreted as success. The retained identities above remain available for explicit inspection or later user-directed cleanup.\n`
}

function planned(plan, flags) {
  const payload = {
    command: 'mission abandon',
    version: 1,
    status: 'confirmation_required',
    mutated: false,
    plan,
    confirmation: recoveryCommand(plan.mission.id, plan.reason, plan.digest),
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Mission ${plan.mission.id} abandonment requires exact confirmation.`)
    console.log(`Plan: ${plan.digest}`)
    console.log(`Confirm: ${payload.confirmation}`)
  }
  return payload
}

function changedPlan(plan, flags) {
  const payload = {
    command: 'mission abandon',
    version: 1,
    status: 'plan_changed',
    mutated: false,
    problem: 'The confirmed plan does not match current Mission state; inspect the replacement.',
    plan,
    confirmation: recoveryCommand(plan.mission.id, plan.reason, plan.digest),
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(payload.problem)
    console.error(`Replacement plan: ${plan.digest}`)
    console.error(`Confirm: ${payload.confirmation}`)
  }
  return payload
}

function success(payload, flags) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Mission ${payload.mission}: abandoned`)
    console.log(`Reason: ${payload.reason}`)
    console.log(`Terminal commit: ${payload.repository.terminal_commit}`)
    console.log(`Retained child worktrees: ${payload.retained.child_worktrees.length}`)
    console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function requiredReason(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  if (value.length > 1000) throw new Error('--reason is too long')
  if (/\p{Cc}/u.test(value)) throw new Error('--reason cannot contain control characters')
  return value.trim()
}

function assertExactRetry(mission, reason, confirmation) {
  if (reason !== mission.abandonment?.reason) {
    throw new Error('retry reason differs from the immutable abandonment')
  }
  if (
    confirmation !== undefined &&
    String(confirmation).trim() !== mission.abandonment.plan_digest
  ) {
    throw new Error('retry confirmation differs from the immutable abandonment plan')
  }
}

function recoveryCommand(id, reason, digestValue) {
  const parts = [`specdev mission abandon ${id}`, `--reason="${shellDoubleQuoted(reason)}"`]
  if (digestValue) parts.push(`--confirm=${digestValue}`)
  return parts.join(' ')
}

function abandonmentJournalPath(specdevPath, missionId) {
  return join(specdevPath, 'cache', 'mission-abandon', `${missionId}.json`)
}

async function writeJournal(path, value) {
  await fse.ensureDir(join(path, '..'))
  await writeJsonAtomic(path, value)
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

async function readJson(path) {
  return fse.readJson(path).catch(() => null)
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function fileDigest(path) {
  return createHash('sha256')
    .update(await fse.readFile(path))
    .digest('hex')
}

async function optionalFileDigest(path) {
  return (await fse.pathExists(path)) ? fileDigest(path) : null
}

async function branchRevision(targetDir, branch) {
  if (!branch) return null
  return gitText(targetDir, ['rev-parse', '--verify', `refs/heads/${branch}`])
}

async function isAncestor(targetDir, ancestor, revision) {
  try {
    await execFile('git', ['merge-base', '--is-ancestor', ancestor, revision], { cwd: targetDir })
    return true
  } catch {
    return false
  }
}

async function gitObjectExists(targetDir, revision) {
  try {
    await execFile('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: targetDir })
    return true
  } catch {
    return false
  }
}

async function gitText(targetDir, args) {
  try {
    return (await execFile('git', args, { cwd: targetDir, encoding: 'utf8' })).stdout.trim()
  } catch {
    return ''
  }
}

async function gitTextStrict(targetDir, args) {
  try {
    return (await execFile('git', args, { cwd: targetDir, encoding: 'utf8' })).stdout
  } catch (error) {
    throw new Error(String(error.stderr || error.message).trim())
  }
}

function assertSamePaths(actual, expected, label) {
  const left = [...new Set(actual)].sort()
  const right = [...new Set(expected)].sort()
  const missing = right.filter((path) => !left.includes(path))
  const unexpected = left.filter((path) => !right.includes(path))
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} mismatch; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
    )
  }
}

function shellDoubleQuoted(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
