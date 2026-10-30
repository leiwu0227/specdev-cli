import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { listAttemptRecords } from './process-record.js'
import { gitStatusEntries } from './git-delivery.js'

export const boundaryHash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

export const terminal = new Set([
  'completed',
  'failed',
  'abandoned',
  'shelved',
  'unsupported',
  'closing',
  'closed',
])
export const readJson = async (path) =>
  fse.readJson(path).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
export async function fileDigest(root, path) {
  if (
    typeof path !== 'string' ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Invalid repository path: ${path}`)
  try {
    const stat = await fse.lstat(join(root, path))
    const bytes = stat.isSymbolicLink()
      ? await fse.readlink(join(root, path))
      : await fse.readFile(join(root, path))
    return createHash('sha256')
      .update(stat.isSymbolicLink() ? 'symlink:' : stat.mode & 0o111 ? 'executable:' : 'file:')
      .update(bytes)
      .digest('hex')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function lifecycleEvents(specdev, runId) {
  const log = await fse.readFile(
    join(specdev, '.ripplegraph', 'runs', runId, 'transition-log.jsonl'),
    'utf8'
  )
  return log.split('\n').filter(Boolean).map(JSON.parse)
}

export async function readBoundaryRecovery(path) {
  const status = await readJson(join(path, 'status.json'))
  const recovery = status?.boundary_recovery
  if (!recovery) return null
  const { digest, ...facts } = recovery.plan
  if (boundaryHash(facts) !== digest || digest !== recovery.digest)
    throw new Error('Invalid Assignment boundary recovery record')
  if (recovery.phase !== 'applied')
    throw new Error(
      `Boundary recovery is pending; retry specdev assignment revalidate-boundary ${status.id} --confirm=${digest}`
    )
  if (
    status.id !== recovery.plan.assignment ||
    status.run_id !== recovery.plan.run_id ||
    status.git_boundary?.starting_git_commit_hash !== recovery.plan.snapshot.head ||
    status.git_boundary?.original_git_commit_hash !== recovery.plan.original_boundary
  )
    throw new Error('Assignment boundary differs from its accepted recovery record')
  const event = recovery.lifecycle_event
  if (
    event?.op !== 'side_channel' ||
    event.runId !== status.run_id ||
    event.output?.actionId !== 'assignment-boundary' ||
    event.output?.input?.confirmation !== digest ||
    event.output?.output?.digest !== digest
  )
    throw new Error('Boundary recovery has no matching lifecycle authorization')
  const specdev = join(path, '../..')
  const logExists = await fse.pathExists(
    join(specdev, '.ripplegraph', 'runs', status.run_id, 'transition-log.jsonl')
  )
  const events = logExists ? await lifecycleEvents(specdev, status.run_id) : null
  if (
    events
      ? !events.some((item) => boundaryHash(item) === boundaryHash(event))
      : !terminal.has(status.status)
  )
    throw new Error('Boundary recovery lifecycle history is missing or inconsistent')
  if (recovery.approval) {
    const approvalEvent = recovery.approval_event
    if (
      approvalEvent?.op !== 'side_channel' ||
      approvalEvent.output?.actionId !== 'assignment-boundary-reapproval' ||
      approvalEvent.output?.input?.digest !== digest ||
      boundaryHash(approvalEvent.output?.output) !== boundaryHash(recovery.approval) ||
      (events && !events.some((item) => boundaryHash(item) === boundaryHash(approvalEvent)))
    )
      throw new Error('Boundary contract reapproval has no matching lifecycle authorization')
  }
  return recovery
}

export async function assertBoundaryEvidence(path, receipts) {
  const recovery = await readBoundaryRecovery(path)
  if (!recovery) return
  const invalid = new Set(
    recovery.plan.evidence.filter((item) => item.action === 'invalidate').map((item) => item.digest)
  )
  if (receipts.some((receipt) => invalid.has(boundaryHash(receipt))))
    throw new Error(
      'Boundary recovery invalidated verification receipts; archive them and record fresh evidence before review'
    )
  for (const item of recovery.plan.evidence.filter((item) => item.action === 'reuse')) {
    const receipt = receipts.find((candidate) => boundaryHash(candidate) === item.digest)
    if (!receipt) continue
    for (const [input, digest] of Object.entries(receipt.input_digests)) {
      if ((await fileDigest(join(path, '../../..'), input)) !== digest)
        throw new Error(`Reused evidence input changed: ${input}`)
    }
  }
}

export async function recoveredDeliveryPaths(root, path, status) {
  const recovery = await readBoundaryRecovery(path)
  if (!recovery) return null
  if (recovery.requires_reapproval && !recovery.approval)
    throw new Error('Boundary recovery requires contract reapproval')
  const prefix = relative(root, path).replaceAll('\\', '/') + '/'
  const runPrefix = `.specdev/.ripplegraph/runs/${status.run_id}/`
  const attempts = await listAttemptRecords(join(root, '.specdev'), {
    assignment: path.split('/').pop(),
  })
  const own = new Set([
    ...recovery.plan.assessment.owned_paths,
    ...attempts.map((item) => `.specdev/processes/${item.id}.yaml`),
  ])
  const entries = await gitStatusEntries(root)
  const excluded = new Map(recovery.plan.snapshot.files.map((item) => [item.path, item.digest]))
  for (const entry of entries) {
    if (
      !entry.path.startsWith('.specdev/') &&
      !own.has(entry.path) &&
      (!excluded.has(entry.path) ||
        excluded.get(entry.path) !== (await fileDigest(root, entry.path)))
    )
      throw new Error(`Product path is outside the recovered ownership boundary: ${entry.path}`)
  }
  return [
    ...new Set(
      entries
        .map((item) => item.path)
        .filter((name) => name.startsWith(prefix) || name.startsWith(runPrefix) || own.has(name))
    ),
  ].sort()
}
