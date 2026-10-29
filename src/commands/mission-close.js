import { createHash } from 'node:crypto'
import { join, resolve, relative } from 'node:path'
import fse from 'fs-extra'
import { abandonRun, readCheckpoint, readCurrent, resumeRun } from 'ripplegraph'
import { readCurrentFocus, clearCurrent } from '../utils/current.js'
import { gitSnapshot } from '../utils/assignment-vnext.js'
import { assertMissionCheckout, assertSequentialMission } from '../utils/mission-checkout.js'
import { missionPathDigest } from '../utils/mission-ownership.js'
import { findCommitByTrailer, gitStatusEntries } from '../utils/git-delivery.js'
import { prepareClosurePublication, publishClosure } from '../utils/mission-closure-delivery.js'
import { readMissionQueue, writeMission, writeMissionQueue } from '../utils/mission.js'
import {
  attemptLiveness,
  listAttemptRecords,
  updateAttemptRecord,
} from '../utils/process-record.js'

const OUTCOME = 'accepted-with-limitations'
const terminalChildren = new Set([
  'completed',
  'integrated',
  'cancelled',
  'abandoned',
  'shelved',
  'unsupported',
  'closed',
])
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')
const same = (a, b) => hash(a) === hash(b)

export function missionClosureError(mission) {
  if (!['closing', 'closed'].includes(mission.status)) return null
  return mission.status === 'closed'
    ? `Mission ${mission.id} is closed and immutable (${OUTCOME})`
    : `Mission ${mission.id} closure is pending; retry the exact confirmed mission close command`
}

export function missionClosureStatus(mission, command = 'mission status') {
  const closure = mission.closure
  return {
    command,
    version: 1,
    mission: mission.id,
    status: mission.status,
    disposition: OUTCOME,
    verification: 'incomplete',
    closure: closure
      ? {
          outcome: OUTCOME,
          confirmed_at: closure.confirmed_at,
          closed_at: closure.closed_at || null,
          plan_digest: closure.plan.digest,
          evidence: closure.plan.evidence,
          artifact: closure.artifact,
          source_status: closure.plan.mission.status,
        }
      : null,
    current_child: null,
    current_children: [],
    controller: null,
    delivery: { outcome: OUTCOME, verified: false },
    landing: null,
    next_action:
      mission.status === 'closing' ? 'Retry the exact confirmed mission close command.' : null,
  }
}

export async function inspectMissionClosure(context, command = 'mission status') {
  const payload = missionClosureStatus(context.mission, command)
  const commit = await findCommitByTrailer(
    context.targetDir,
    'SpecDev-Closure-Plan',
    context.mission.closure.plan.digest,
    { revision: 'HEAD' }
  )
  payload.repository = { terminal_commit: commit }
  if (!commit) {
    payload.status = 'closing'
    payload.next_action =
      'Retry the exact confirmed mission close command to finish closure and its commit.'
  }
  return payload
}

export async function closeMissionCommand(context, flags = {}) {
  try {
    if (flags.outcome !== OUTCOME) throw new Error(`Mission close requires --outcome=${OUTCOME}`)
    if (typeof flags.evidence !== 'string' || !flags.evidence.trim()) {
      throw new Error(
        'Mission close requires --evidence=<acceptance-note> with written user acceptance of the limitations'
      )
    }
    const { mission, missionPath, targetDir } = context
    const source = relative(targetDir, resolve(targetDir, flags.evidence))
    const confirm = typeof flags.confirm === 'string' ? flags.confirm : ''
    if (missionClosureError(mission)) {
      const closure = mission.closure
      if (!closure || closure.plan.digest !== confirm || closure.plan.evidence.source !== source) {
        throw new Error('Closure retry requires the exact evidence path and confirmed plan digest')
      }
      const { digest, ...facts } = closure.plan
      if (hash(facts) !== digest) throw new Error('Stored closure plan is invalid')
      if (mission.status !== 'closed') await applyClosure(context, closure, flags)
      const repository = await publishClosure(context)
      return emit(flags, {
        ...missionClosureStatus(context.mission, 'mission close'),
        repository,
        idempotent: true,
      })
    }
    if (['completed', 'abandoned'].includes(mission.status)) {
      throw new Error(`Mission ${mission.id} is already ${mission.status} and is immutable`)
    }
    const plan = await buildPlan(context, source)
    if (!confirm)
      return emit(flags, {
        command: 'mission close',
        version: 1,
        status: 'confirmation_required',
        mutated: false,
        plan,
        next_action:
          'Obtain explicit user acceptance of this exact plan and its limitations, then repeat with --confirm=<plan-digest>.',
      })
    if (confirm !== plan.digest)
      throw new Error(
        'Closure plan changed or --confirm is invalid; inspect a fresh plan and obtain explicit user acceptance again'
      )
    // Recheck immediately before the first durable mutation.
    if ((await buildPlan(context, source)).digest !== confirm)
      throw new Error('Confirmed closure state changed')
    const closure = {
      version: 1,
      outcome: OUTCOME,
      confirmed_at: new Date().toISOString(),
      plan,
      artifact: relative(targetDir, join(missionPath, 'closure.md')),
    }
    context.mission = { ...mission, status: 'closing', closure }
    await writeMission(missionPath, context.mission)
    interrupt(flags, 'authority-confirmed')
    await applyClosure(context, closure, flags)
    const repository = await publishClosure(context)
    return emit(flags, {
      ...missionClosureStatus(context.mission, 'mission close'),
      repository,
      idempotent: false,
    })
  } catch (error) {
    process.exitCode = 1
    return emit(flags, {
      command: 'mission close',
      version: 1,
      status: 'error',
      error: error.message,
    })
  }
}

async function buildPlan(context, source) {
  const { targetDir, specdevPath, missionPath, mission } = context
  await assertMissionCheckout(targetDir, mission, { containment: false })
  await assertSequentialMission(missionPath, mission)
  const evidencePath = resolve(targetDir, source)
  const info = await fse.lstat(evidencePath)
  if (!info.isFile() || info.size > 128 * 1024)
    throw new Error('Acceptance evidence must be a regular text file of at most 128 KiB')
  const text = await fse.readFile(evidencePath, 'utf8')
  if (!text.trim() || text.includes('\0'))
    throw new Error('Acceptance evidence must be non-empty written user acceptance and limitations')
  const children = await ownedChildren(context)
  const checkpoint = readCheckpoint(specdevPath, mission.run_id)
  const terminalFailure =
    mission.status === 'failed' &&
    checkpoint.status === 'completed' &&
    checkpoint.position.graph === 'mission-lifecycle' &&
    checkpoint.position.node === 'failed' &&
    checkpoint.stack.length === 0
  if (
    checkpoint.rootGraph !== 'mission-lifecycle' ||
    (!['active', 'suspended'].includes(checkpoint.status) && !terminalFailure)
  ) {
    throw new Error(
      'Mission close requires an active, suspended, or terminal failed Mission lifecycle'
    )
  }
  const rippleFocus = readCurrent(specdevPath).focusedRunId
  if (
    (checkpoint.status === 'active' && rippleFocus !== mission.run_id) ||
    (checkpoint.status !== 'active' && rippleFocus)
  ) {
    throw new Error('Mission run/focus mismatch; another workflow must not be displaced')
  }
  const focus = await readCurrentFocus(specdevPath)
  if (focus && !ownsFocus(mission, children, focus))
    throw new Error('Mission does not own the current workflow focus')
  const attempts = await inspectAttempts(context, children)
  const queue = await optionalQueue(missionPath)
  for (const child of queue?.assignments || []) {
    if (
      child.folder &&
      !children.some(
        (owned) => owned.folder === child.folder && String(owned.status.id) === String(child.id)
      )
    ) {
      throw new Error(`Mission queue child ownership is missing or ambiguous: ${child.id}`)
    }
  }
  const missionRoot = relative(targetDir, missionPath)
  const terminalPaths = [
    `${missionRoot}/mission.yaml`,
    `${missionRoot}/status.json`,
    `${missionRoot}/closure.md`,
    ...(queue ? [`${missionRoot}/design/assignments.yaml`] : []),
    ...children
      .filter((child) => !terminalChildren.has(child.status.status))
      .map((child) => `.specdev/assignments/${child.folder}/status.json`),
    ...attempts
      .filter((attempt) => attempt.status === 'running')
      .map((attempt) => `.specdev/processes/${attempt.id}.yaml`),
    `.specdev/.ripplegraph/runs/${mission.run_id}/checkpoint.json`,
    `.specdev/.ripplegraph/runs/${mission.run_id}/transition-log.jsonl`,
    '.specdev/.ripplegraph/current.json',
    ...(focus ? ['.specdev/.current'] : []),
  ].sort()
  const sourceFiles = {}
  for (const path of terminalPaths) {
    try {
      sourceFiles[path] = hash(await fse.readFile(join(targetDir, path)))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      sourceFiles[path] = null
    }
  }
  if (sourceFiles[`${missionRoot}/closure.md`] !== null)
    throw new Error('An existing closure artifact must not be overwritten')
  const facts = {
    version: 1,
    operation: 'mission-close',
    outcome: OUTCOME,
    mission,
    evidence: { source, sha256: hash(text), text },
    checkout: await checkoutSnapshot(targetDir),
    focus,
    checkpoint,
    children,
    queue,
    attempts,
    artifacts: await retainedArtifacts(context, children),
    previous_status: await optionalJson(join(missionPath, 'status.json')),
    terminal_paths: terminalPaths,
    source_files: sourceFiles,
    effects: [
      'Record user-accepted delivery with incomplete verification',
      'Close unfinished owned children and stop the owned scheduler',
      'Release owned focus; retain code, artifacts, verification records, and runtime history',
      'Commit only the exact closure records; preserve unrelated changes and the product candidate',
    ],
  }
  return { ...facts, digest: hash(facts) }
}

async function ownedChildren({ specdevPath, mission }) {
  const root = join(specdevPath, 'assignments')
  const children = []
  for (const entry of (await fse.readdir(root, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (!entry.isDirectory()) continue
    const status = await optionalJson(join(root, entry.name, 'status.json'))
    if (status?.mission !== mission.id) continue
    if (
      !/^\d{5}_[^/\\]+$/.test(entry.name) ||
      !entry.name.startsWith(`${status.id}_`) ||
      status.run_id !== mission.run_id
    ) {
      throw new Error(`Ambiguous or separate child execution ownership: ${entry.name}`)
    }
    children.push({ folder: entry.name, status })
  }
  return children
}

async function inspectAttempts(context, children) {
  const owners = new Set(children.flatMap((child) => [child.folder, String(child.status.id)]))
  const result = []
  for (const record of await listAttemptRecords(context.specdevPath)) {
    if (record.mission !== context.mission.id && !owners.has(record.assignment)) continue
    if (record.mission && record.mission !== context.mission.id)
      throw new Error(`Ambiguous Attempt owner: ${record.id}`)
    if (record.status === 'running') {
      const liveness = await attemptLiveness(context.specdevPath, record.id)
      if (liveness.state !== 'stale')
        throw new Error(
          `Live or ambiguous execution: ${record.id} (${liveness.state}); stop or resolve it before closure`
        )
    }
    result.push(record)
  }
  return result
}

async function checkoutSnapshot(targetDir) {
  const snapshot = await gitSnapshot(targetDir)
  const product = (await gitStatusEntries(targetDir))
    .map((entry) => entry.path)
    .filter((path) => !path.startsWith('.specdev/'))
  return {
    revision: snapshot.revision,
    branch: snapshot.branch,
    dirty_product: await Promise.all(
      product.map(async (path) => ({ path, sha256: await missionPathDigest(targetDir, path) }))
    ),
  }
}

async function retainedArtifacts(context, children) {
  const roots = [
    context.missionPath,
    ...children.map((child) => join(context.specdevPath, 'assignments', child.folder)),
  ]
  const excluded = new Set([
    join(context.missionPath, 'mission.yaml'),
    join(context.missionPath, 'status.json'),
    join(context.missionPath, 'closure.md'),
    join(context.missionPath, 'design', 'assignments.yaml'),
    ...children.map((child) =>
      join(context.specdevPath, 'assignments', child.folder, 'status.json')
    ),
  ])
  const files = {}
  async function visit(path) {
    if (excluded.has(path)) return
    const stat = await fse.lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`Closure artifacts must not be symlinks: ${path}`)
    if (stat.isDirectory()) {
      for (const name of (await fse.readdir(path)).sort()) await visit(join(path, name))
    } else if (stat.isFile())
      files[relative(context.targetDir, path)] = hash(await fse.readFile(path))
    else throw new Error(`Unsupported closure artifact: ${path}`)
  }
  for (const root of roots) await visit(root)
  return files
}

async function applyClosure(context, closure, flags) {
  const { specdevPath, missionPath } = context
  const { plan } = closure
  await assertMissionCheckout(context.targetDir, plan.mission, { containment: false })
  if (!same(await checkoutSnapshot(context.targetDir), plan.checkout))
    throw new Error(
      'Closure recovery checkout changed; preserve and resolve the changed work before retrying'
    )
  if (!same(await retainedArtifacts(context, plan.children), plan.artifacts))
    throw new Error('Retained closure artifacts changed; recovery will not overwrite them')
  const children = await ownedChildren(context)
  if (
    !same(
      children.map((child) => child.folder),
      plan.children.map((child) => child.folder)
    )
  )
    throw new Error('Closure child ownership changed')
  const attempts = await inspectAttempts(context, plan.children)
  if (
    !same(
      attempts.map((item) => item.id),
      plan.attempts.map((item) => item.id)
    )
  )
    throw new Error('Closure Attempts changed')
  const focus = await readCurrentFocus(specdevPath)
  if (focus && !same(focus, plan.focus)) throw new Error('Workflow focus changed during closure')
  const checkpoint = readCheckpoint(specdevPath, plan.mission.run_id)
  const { status: oldStatus, updatedAt: oldUpdated, ...oldState } = plan.checkpoint
  const { status, updatedAt, ...state } = checkpoint
  // resumeRun may add no semantic changes; abandonment retains node outputs and stack.
  const allowedStatuses =
    oldStatus === 'completed' ? [oldStatus] : [oldStatus, 'active', 'abandoned']
  if (
    !same(state, oldState) ||
    !allowedStatuses.includes(status) ||
    (oldStatus === 'completed' && !same(checkpoint, plan.checkpoint))
  )
    throw new Error('Mission runtime changed during closure')
  const rippleFocus = readCurrent(specdevPath).focusedRunId
  if (rippleFocus && rippleFocus !== plan.mission.run_id)
    throw new Error('Another workflow owns runtime focus; closure will not displace it')

  const queue = plan.queue ? structuredClone(plan.queue) : null
  for (const child of queue?.assignments || []) {
    if (!terminalChildren.has(child.status)) {
      child.closure = {
        outcome: OUTCOME,
        source_status: child.status || null,
        plan_digest: plan.digest,
      }
      child.status = 'cancelled'
    }
  }
  const currentQueue = await optionalQueue(missionPath)
  if (!same(currentQueue, plan.queue) && !same(currentQueue, queue))
    throw new Error('Mission queue changed during closure')
  for (const child of plan.children) {
    const path = join(specdevPath, 'assignments', child.folder, 'status.json')
    const next = terminalChildren.has(child.status.status)
      ? child.status
      : {
          ...child.status,
          status: 'closed',
          closure: {
            outcome: OUTCOME,
            source_status: child.status.status || null,
            mission: plan.mission.id,
            plan_digest: plan.digest,
            closed_at: closure.confirmed_at,
          },
        }
    const current = await fse.readJson(path)
    if (!same(current, child.status) && !same(current, next))
      throw new Error(`Child status changed during closure: ${child.folder}`)
  }
  const nextStatus = {
    ...(plan.previous_status || {}),
    status: 'closed',
    disposition: OUTCOME,
    verification: 'incomplete',
    plan_digest: plan.digest,
    closed_at: closure.confirmed_at,
  }
  const currentStatus = await optionalJson(join(missionPath, 'status.json'))
  if (!same(currentStatus, plan.previous_status) && !same(currentStatus, nextStatus))
    throw new Error('Mission status changed during closure')
  for (const record of attempts) {
    const original = plan.attempts.find((item) => item.id === record.id)
    if (same(record, original)) continue
    if (
      original.status !== 'running' ||
      record.status !== 'interrupted' ||
      record.closure_plan !== plan.digest
    )
      throw new Error(`Attempt changed during closure: ${record.id}`)
  }

  const runtimeClosure =
    plan.checkpoint.status === 'completed'
      ? 'The already terminal failed lifecycle remains unchanged.'
      : 'The scheduler is stopped through RippleGraph abandonment.'
  await atomicText(
    join(missionPath, 'closure.md'),
    `# Mission closure\n\n- Mission: ${plan.mission.id}\n- Source status: ${plan.mission.status}\n- Outcome: ${OUTCOME}\n- Verification: incomplete; failures and missing evidence remain unchanged\n- Confirmed plan: ${plan.digest}\n- Acceptance source: ${plan.evidence.source}\n- Acceptance SHA-256: ${plan.evidence.sha256}\n\n## User acceptance and limitations\n\n${plan.evidence.text}\n\n## Execution closure\n\nUnfinished children are closed without verified completion. ${runtimeClosure} The Mission outcome is accepted-with-limitations. Code, artifacts, verification records, and runtime history are retained. No landing is performed.\n`
  )
  if (queue) await writeMissionQueue(missionPath, queue)
  for (const child of plan.children) {
    if (terminalChildren.has(child.status.status)) continue
    await atomicJson(join(specdevPath, 'assignments', child.folder, 'status.json'), {
      ...child.status,
      status: 'closed',
      closure: {
        outcome: OUTCOME,
        source_status: child.status.status || null,
        mission: plan.mission.id,
        plan_digest: plan.digest,
        closed_at: closure.confirmed_at,
      },
    })
  }
  await atomicJson(join(missionPath, 'status.json'), nextStatus)
  interrupt(flags, 'terminal-written')
  for (const record of attempts) {
    if (record.status === 'running')
      await updateAttemptRecord(specdevPath, record.id, {
        status: 'interrupted',
        closure_plan: plan.digest,
        error:
          'Stale execution stopped by user-accepted Mission closure; verification remains incomplete',
      })
  }
  if (checkpoint.status === 'suspended')
    resumeRun({ workflowRoot: specdevPath, runId: plan.mission.run_id })
  if (readCheckpoint(specdevPath, plan.mission.run_id).status === 'active') {
    if (readCurrent(specdevPath).focusedRunId !== plan.mission.run_id)
      throw new Error('Mission lost runtime focus before closure')
    abandonRun({
      workflowRoot: specdevPath,
      reason: `Mission ${plan.mission.id} closed ${OUTCOME}; plan ${plan.digest}; verification incomplete`,
    })
  }
  interrupt(flags, 'run-closed')
  if (focus && ownsFocus(plan.mission, plan.children, focus)) await clearCurrent(specdevPath)
  context.mission = {
    ...plan.mission,
    status: 'closed',
    disposition: OUTCOME,
    next_action: null,
    closure: { ...closure, closed_at: closure.confirmed_at },
  }
  await prepareClosurePublication(context)
  await writeMission(missionPath, context.mission)
  interrupt(flags, 'prepared')
}

function ownsFocus(mission, children, focus) {
  return (
    (focus.kind === 'mission' && focus.id === mission.id) ||
    (focus.kind === 'assignment' && children.some((child) => String(child.status.id) === focus.id))
  )
}
async function optionalJson(path) {
  try {
    return await fse.readJson(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
async function optionalQueue(path) {
  try {
    return await readMissionQueue(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
async function atomicJson(path, value) {
  await atomicText(path, `${JSON.stringify(value, null, 2)}\n`)
}
async function atomicText(path, text) {
  await fse.ensureDir(resolve(path, '..'))
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeFile(temporary, text)
  await fse.move(temporary, path, { overwrite: true })
}
function interrupt(flags, phase) {
  if (flags['interrupt-after'] === phase)
    throw new Error(
      `simulated interruption after ${phase}; retry the exact confirmed closure command`
    )
}
function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else if (payload.error) console.error(payload.error)
  else if (payload.plan) {
    console.log(`Mission ${payload.plan.mission.id}: user acceptance required`)
    console.log(`Evidence: ${payload.plan.evidence.source}\n${payload.plan.evidence.text}`)
    console.log(`Source state: ${payload.plan.mission.status}; verification remains incomplete`)
    console.log(
      `Children: ${payload.plan.children.map((child) => child.folder).join(', ') || 'none'}`
    )
    console.log(payload.plan.effects.join('\n'))
    console.log(`Plan digest: ${payload.plan.digest}\n${payload.next_action}`)
  } else
    console.log(
      `Mission ${payload.mission}: ${payload.status} (${OUTCOME}); verification remains incomplete`
    )
  return payload
}
