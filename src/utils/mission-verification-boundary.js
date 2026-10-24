import { createHash } from 'node:crypto'
import { dirname, join, resolve, relative } from 'node:path'
import fse from 'fs-extra'
import { getState, readCheckpoint, readCurrent, recordSideChannelAction } from 'ripplegraph'
import { gitSnapshot, validateContractPath } from './assignment-vnext.js'
import { readMission, readMissionQueue, resolveMissionSelector } from './mission.js'
import { assertMissionCheckout, assertSequentialMission } from './mission-checkout.js'
import { missionOwnedPaths, missionPathDigest } from './mission-ownership.js'
import { attemptLiveness, listAttemptRecords } from './process-record.js'
import { productStateDigest } from './spawned-agent.js'

const actionId = 'mission-verification-boundary'
const boundaryFile = 'verification-boundary.json'
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')
const readOptional = async (path) =>
  fse
    .readFile(path)
    .then((bytes) => bytes.toString('base64'))
    .catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })

export function validateVerificationMapping(mapping, ids) {
  const child = mapping.child_acceptance
  const mission = mapping.mission_acceptance
  if (!Array.isArray(child) || !child.length || !Array.isArray(mission))
    throw new Error(
      'Verification ownership requires child_acceptance and mission_acceptance arrays, with at least one child criterion'
    )
  const all = [...child, ...mission]
  if (
    new Set(all).size !== all.length ||
    all.length !== ids.length ||
    all.some((id) => !ids.includes(id))
  )
    throw new Error('Verification ownership must partition every parent acceptance ID exactly once')
  return { child_acceptance: child, mission_acceptance: mission }
}

export function declaredVerificationOwnership(contract, { legacyApproved = false } = {}) {
  // Older approvals inherited all parent criteria. Preserve that exact boundary;
  // only an explicit recovery decision can separate it later.
  if (legacyApproved && !/^## Verification ownership\s*$/m.test(contract.content))
    return { child_acceptance: [...contract.acceptanceIds], mission_acceptance: [] }
  const section =
    contract.content.match(/^## Verification ownership\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ||
    ''
  const parse = (label) => {
    const lines = [...section.matchAll(new RegExp(`^- ${label}: (.+)$`, 'gm'))]
    if (lines.length !== 1)
      throw new Error(
        'Single-child Missions require explicit ## Verification ownership with Child acceptance and Mission acceptance lists (use none for an empty list)'
      )
    return lines[0][1].trim() === 'none' ? [] : lines[0][1].split(',').map((value) => value.trim())
  }
  return validateVerificationMapping(
    {
      child_acceptance: parse('Child acceptance'),
      mission_acceptance: parse('Mission acceptance'),
    },
    contract.acceptanceIds
  )
}

export function selectChildAcceptance(section, ownership) {
  return section
    .split(/(?=^\s*-\s+AC-\d+\s*:)/m)
    .filter((block) =>
      ownership.child_acceptance.includes(block.match(/^\s*-\s+(AC-\d+)\s*:/m)?.[1])
    )
    .join('')
    .trim()
}

async function candidateDigest(targetDir) {
  const git = await gitSnapshot(targetDir)
  const diff = await productStateDigest(targetDir)
  if (!diff) return null
  const paths = git.dirty_paths
    .filter((path) => path !== '.specdev' && !path.startsWith('.specdev/'))
    .sort()
  const bytes = []
  for (const path of paths) bytes.push([path, await missionPathDigest(targetDir, path)])
  return hash({ revision: git.revision, diff, bytes })
}

async function events(specdevPath, runId) {
  const text = await fse.readFile(
    join(specdevPath, '.ripplegraph', 'runs', runId, 'transition-log.jsonl'),
    'utf8'
  )
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}
async function recorded(specdevPath, plan) {
  return (await events(specdevPath, plan.run_id)).some(
    (event) =>
      event.op === 'side_channel' &&
      event.output?.actionId === actionId &&
      event.output?.output?.digest === plan.digest
  )
}
async function atomicJson(path, value) {
  await fse.outputJson(`${path}.tmp`, value, { spaces: 2 })
  await fse.move(`${path}.tmp`, path, { overwrite: true })
}

// The original contract remains the hash-bound authority for behavior and scope.
// This separately confirmed decision changes only where acceptance is evaluated.
export async function readVerificationBoundary(assignmentPath) {
  const path = join(assignmentPath, boundaryFile)
  if (!(await fse.pathExists(path))) return null
  const { plan, status, lifecycle_event: lifecycleEvent } = await fse.readJson(path)
  const { digest, ...facts } = plan
  if (hash(facts) !== digest) throw new Error('Invalid verification boundary digest')
  if (status !== 'applied')
    throw new Error('Verification boundary recovery is pending; retry its exact confirmed command')
  const specdevPath = dirname(dirname(assignmentPath))
  const targetDir = dirname(specdevPath)
  const parent = await resolveMissionSelector(specdevPath, plan.mission)
  const childStatus = await fse.readJson(join(assignmentPath, 'status.json'))
  if (
    !parent ||
    childStatus.mission !== plan.mission ||
    childStatus.run_id !== plan.run_id ||
    childStatus.id !== plan.child
  )
    throw new Error('Verification boundary ownership changed')
  const mission = await readMission(parent.path)
  const childContract = await validateContractPath(
    join(assignmentPath, 'brainstorm', 'contract.md')
  )
  const parentContract = await validateContractPath(join(parent.path, 'brainstorm', 'contract.md'))
  if (
    childContract.hash !== plan.child_contract_hash ||
    parentContract.hash !== plan.parent_contract_hash ||
    mission.approved_contract_hash !== plan.parent_contract_hash
  )
    throw new Error('Verification boundary contracts changed')
  validateVerificationMapping(plan.mapping, childContract.acceptanceIds)
  const terminal = ['completed', 'failed', 'abandoned', 'closed'].includes(mission.status)
  const logExists = await fse.pathExists(
    join(specdevPath, '.ripplegraph', 'runs', plan.run_id, 'transition-log.jsonl')
  )
  const archivedApproval =
    lifecycleEvent?.op === 'side_channel' &&
    lifecycleEvent?.runId === plan.run_id &&
    lifecycleEvent?.output?.actionId === actionId &&
    lifecycleEvent?.output?.input?.confirmation === plan.digest &&
    lifecycleEvent?.output?.output?.digest === plan.digest
  if (!(logExists ? await recorded(specdevPath, plan) : terminal && archivedApproval))
    throw new Error('Verification boundary has no lifecycle approval')
  return { ...plan, targetDir }
}

export async function boundaryVerificationReceipts(assignmentPath, receipts) {
  const boundary = await readVerificationBoundary(assignmentPath)
  if (!boundary || !boundary.evidence.length) return receipts
  const git = await gitSnapshot(boundary.targetDir)
  if (
    git.revision !== boundary.revision ||
    (await candidateDigest(boundary.targetDir)) !== boundary.product_digest
  )
    return receipts // An old candidate never lends authority to a changed candidate.
  const derived = []
  for (const selected of boundary.evidence) {
    const receipt = receipts?.[selected.index]
    if (!receipt || hash(receipt) !== selected.digest) continue
    if (
      receipts
        .slice(selected.index + 1)
        .some(
          (later) =>
            later.command === receipt.command &&
            later.scope === receipt.scope &&
            later.revision === receipt.revision
        )
    )
      continue
    derived.push({
      ...receipt,
      role: 'authoritative_acceptance',
      boundary_digest: boundary.digest,
      acceptance: selected.acceptance,
    })
  }
  const covered = new Set(derived.flatMap((receipt) => receipt.acceptance))
  if (boundary.mapping.child_acceptance.some((id) => !covered.has(id))) return receipts
  return [...receipts, ...derived]
}

export async function recoverVerificationBoundary(context, flags) {
  const { targetDir, specdevPath, missionPath, mission } = context
  if (typeof flags.child !== 'string' || typeof flags.mapping !== 'string')
    throw new Error(
      'Use --child=<id> --mapping=<JSON-file> and confirm the preview with --confirm=<digest>'
    )
  await assertMissionCheckout(targetDir, mission)
  await assertSequentialMission(missionPath, mission)
  const queue = await readMissionQueue(missionPath)
  const child = queue.assignments?.find((entry) => String(entry.id) === flags.child)
  if (
    queue.design_mode !== 'single' ||
    queue.assignments.length !== 1 ||
    !child ||
    !/^\d{5}_[^/\\]+$/.test(child.folder || '')
  )
    throw new Error('Recovery requires the single full-scope Mission child')
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  const existing = await fse.readJson(join(assignmentPath, boundaryFile)).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (existing?.status === 'applied') {
    const source = relative(targetDir, resolve(targetDir, flags.mapping))
    const input = await fse.readJson(resolve(targetDir, flags.mapping)).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (
      flags.confirm !== existing.plan.digest ||
      source !== existing.plan.mapping_source ||
      (input !== null && hash(input) !== existing.plan.mapping_hash)
    )
      throw new Error('Recovery already exists; retry its exact mapping and confirmation')
    await readVerificationBoundary(assignmentPath)
    return { status: 'applied', digest: existing.plan.digest, idempotent: true }
  }
  if (mission.status !== 'running')
    throw new Error('Verification boundary recovery requires a running Mission')
  const status = await fse.readJson(join(assignmentPath, 'status.json'))
  if (
    status.mission !== mission.id ||
    status.run_id !== mission.run_id ||
    String(status.id) !== flags.child ||
    status.contract_source?.type !== 'mission-full-scope' ||
    status.contract_source?.parent_hash !== mission.approved_contract_hash
  )
    throw new Error('Wrong child ownership or parent approval')
  const current = readCurrent(specdevPath)
  const state = getState({ workflowRoot: specdevPath })
  const checkpoint = readCheckpoint(specdevPath, mission.run_id)
  const scope = checkpoint.stack.at(-1)?.scope || ''
  const output = (name) => checkpoint.outputs[scope ? `${scope}/${name}` : name]
  if (
    current.focusedRunId !== mission.run_id ||
    state.status !== 'ok' ||
    state.position?.graph !== 'assignment-lifecycle' ||
    !['implementation-review', 'repair'].includes(state.position.node) ||
    output('create-assignment')?.name !== child.folder
  )
    throw new Error('Recovery requires the focused child at implementation review or repair')
  const attempts = []
  for (const record of await listAttemptRecords(specdevPath)) {
    if (record.mission !== mission.id && ![child.folder, flags.child].includes(record.assignment))
      continue
    if (
      record.status === 'running' &&
      (await attemptLiveness(specdevPath, record.id)).state !== 'stale'
    )
      throw new Error(`Live or ambiguous execution: ${record.id}`)
    attempts.push(record)
  }
  const parentContract = await validateContractPath(join(missionPath, 'brainstorm', 'contract.md'))
  const childContract = await validateContractPath(
    join(assignmentPath, 'brainstorm', 'contract.md')
  )
  if (
    !parentContract.valid ||
    !childContract.valid ||
    parentContract.hash !== mission.approved_contract_hash ||
    !output('approve-contract')?.approved ||
    childContract.hash !== output('approve-contract').contract_hash
  )
    throw new Error('Restore the unchanged approved contracts before recovery')
  if (JSON.stringify(childContract.acceptanceIds) !== JSON.stringify(parentContract.acceptanceIds))
    throw new Error('Recovery only separates an inherited full-scope acceptance boundary')
  const mappingSource = relative(targetDir, resolve(targetDir, flags.mapping))
  const input = await fse.readJson(resolve(targetDir, flags.mapping))
  if (
    Object.keys(input).some(
      (key) => !['child_acceptance', 'mission_acceptance', 'evidence'].includes(key)
    )
  )
    throw new Error('Mapping cannot change scope, contracts, or final command')
  const mapping = validateVerificationMapping(input, parentContract.acceptanceIds)
  if (!mapping.mission_acceptance.length)
    throw new Error('Recovery must identify controller-owned criteria')
  const finalCommands = [...parentContract.content.matchAll(/^- Command: `([^`]+)`\s*$/gm)]
  if (finalCommands.length !== 1) throw new Error('Parent final command is ambiguous')
  if (queue.final_verification?.command !== finalCommands[0][1])
    throw new Error('Queue final verification differs from parent authority')
  const progress = await fse.readJson(join(assignmentPath, 'implementation', 'progress.json'))
  const git = await gitSnapshot(targetDir)
  const productDigest = await candidateDigest(targetDir)
  if (!git.revision || !productDigest) throw new Error('Candidate identity is unavailable')
  const owned = await missionOwnedPaths(context)
  if (git.dirty_paths.some((path) => !path.startsWith('.specdev/') && !owned.includes(path)))
    throw new Error('Unowned product changes prevent candidate-bound evidence recovery')
  if (input.evidence !== undefined && !Array.isArray(input.evidence))
    throw new Error('evidence must be an array')
  const evidence = (input.evidence || []).map((selection) => {
    const receipt = progress.verification?.[selection.index]
    if (
      !Number.isInteger(selection.index) ||
      !receipt ||
      receipt.status !== 'passed' ||
      !receipt.command?.trim() ||
      !receipt.scope?.trim() ||
      !Number.isFinite(receipt.duration_ms) ||
      receipt.duration_ms < 0 ||
      ![git.revision, `working-tree@${git.revision}`].includes(receipt.revision) ||
      receipt.command === finalCommands[0][1]
    )
      throw new Error(
        'Selected evidence must be passing focused evidence on the current candidate with command, scope, revision, and duration'
      )
    if (
      !Array.isArray(selection.acceptance) ||
      !selection.acceptance.length ||
      selection.acceptance.some((id) => !mapping.child_acceptance.includes(id))
    )
      throw new Error('Evidence selection must explicitly name child acceptance criteria')
    if (
      progress.verification
        .slice(selection.index + 1)
        .some(
          (later) =>
            later.command === receipt.command &&
            later.scope === receipt.scope &&
            later.revision === receipt.revision
        )
    )
      throw new Error('Selected evidence has been superseded')
    return {
      index: selection.index,
      digest: hash(receipt),
      acceptance: selection.acceptance,
      receipt,
    }
  })
  if (
    evidence.length &&
    mapping.child_acceptance.some((id) => !evidence.some((item) => item.acceptance.includes(id)))
  )
    throw new Error(
      'Selected evidence must cover every child criterion; otherwise omit evidence and collect authorized acceptance evidence'
    )
  const path = join(assignmentPath, boundaryFile)
  const prior = await fse.readJson(path).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (prior) {
    if (
      flags.confirm !== prior.plan.digest ||
      mappingSource !== prior.plan.mapping_source ||
      hash(input) !== prior.plan.mapping_hash
    )
      throw new Error('Recovery already exists; retry its exact mapping and confirmation')
    const { digest, ...facts } = prior.plan
    if (
      hash(facts) !== digest ||
      prior.plan.product_digest !== productDigest ||
      prior.plan.revision !== git.revision ||
      prior.plan.child_contract_hash !== childContract.hash ||
      prior.plan.parent_contract_hash !== parentContract.hash
    )
      throw new Error('Recovery candidate or authority changed; cannot resume')
    if (prior.status === 'applied') {
      await readVerificationBoundary(assignmentPath)
      return { status: 'applied', digest, idempotent: true }
    }
    if (
      hash(checkpoint) !== hash(prior.plan.checkpoint) ||
      hash(queue) !== hash(prior.plan.queue) ||
      hash(attempts) !== hash(prior.plan.attempts) ||
      hash(mission) !== hash(prior.plan.mission_snapshot) ||
      hash(status) !== hash(prior.plan.child_status)
    )
      throw new Error('Execution changed during interrupted recovery')
    for (const [name, bytes] of Object.entries(prior.plan.artifacts)) {
      if (name === 'review/implementation-state.json') {
        const currentState = await fse.readJson(join(assignmentPath, name)).catch(() => null)
        if (
          currentState?.boundary_digest === digest &&
          currentState?.stage === 'primary' &&
          currentState?.round === 0
        )
          continue
      }
      if ((await readOptional(join(assignmentPath, name))) !== bytes)
        throw new Error('Evidence changed during interrupted recovery')
    }
    return applyBoundary(specdevPath, assignmentPath, prior.plan)
  }
  const artifacts = {}
  for (const name of [
    'design/plan.md',
    'implementation/progress.json',
    'implementation/worker-result.md',
    'implementation/repair-result.md',
    'implementation/resolver-result.md',
    'outcome.md',
    'review/implementation-state.json',
    'review/implementation-verdict.md',
    'review/candidate-receipt.json',
  ])
    artifacts[name] = await readOptional(join(assignmentPath, name))
  const facts = {
    version: 1,
    mission: mission.id,
    child: flags.child,
    run_id: mission.run_id,
    parent_contract_hash: parentContract.hash,
    child_contract_hash: childContract.hash,
    old_boundary: {
      child_acceptance: childContract.acceptanceIds,
      final_verification_owner: 'mission-controller',
    },
    child_approval: output('approve-contract'),
    mapping_source: mappingSource,
    mapping_hash: hash(input),
    mapping,
    evidence,
    final_command: finalCommands[0][1],
    revision: git.revision,
    product_digest: productDigest,
    queue,
    checkpoint,
    mission_snapshot: mission,
    child_status: status,
    attempts,
    artifacts,
  }
  const plan = { ...facts, digest: hash(facts) }
  if (!flags.confirm)
    return {
      status: 'awaiting_confirmation',
      plan,
      next_action: `Confirm this exact boundary with --confirm=${plan.digest}. This authorizes only the listed evidence on this candidate; Mission acceptance remains pending.`,
    }
  if (flags.confirm !== plan.digest)
    throw new Error('Stale verification boundary confirmation; preview again')
  await atomicJson(path, { status: 'pending', plan })
  return applyBoundary(specdevPath, assignmentPath, plan)
}

async function applyBoundary(specdevPath, assignmentPath, plan) {
  // Persist exact historical bytes before resetting review. Repeating writes is safe.
  const archive = join(assignmentPath, 'review', 'verification-boundary-history', plan.digest)
  for (const [name, bytes] of Object.entries(plan.artifacts)) {
    if (bytes !== null) await fse.outputFile(join(archive, name), Buffer.from(bytes, 'base64'))
  }
  if (!(await recorded(specdevPath, plan)))
    recordSideChannelAction({
      workflowRoot: specdevPath,
      actionId,
      note: 'User confirmed verification ownership; original contracts and Mission final verification remain unchanged',
      input: { confirmation: plan.digest },
      output: { digest: plan.digest, child: plan.child, mapping: plan.mapping },
    })
  await atomicJson(join(assignmentPath, 'review', 'implementation-state.json'), {
    version: 2,
    stage: 'primary',
    round: 0,
    primary_round: 0,
    history: [],
    boundary_digest: plan.digest,
  })
  const lifecycleEvent = (await events(specdevPath, plan.run_id)).find(
    (event) =>
      event.op === 'side_channel' &&
      event.output?.actionId === actionId &&
      event.output?.output?.digest === plan.digest
  )
  await atomicJson(join(assignmentPath, boundaryFile), {
    status: 'applied',
    plan,
    lifecycle_event: lifecycleEvent,
  })
  return {
    status: 'applied',
    digest: plan.digest,
    child_acceptance: plan.mapping.child_acceptance,
    mission_acceptance_pending: plan.mapping.mission_acceptance,
    next_action:
      'Resume Mission child implementation review. At repair, provide the normal foreground repair result. The controller still owns final integrated verification.',
  }
}
