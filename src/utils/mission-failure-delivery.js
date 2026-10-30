import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { stringify } from 'yaml'
import { readCheckpoint, readCurrent, writeCurrent } from 'ripplegraph'
import { readCurrentFocus, clearCurrent } from './current.js'
import { writeMission } from './mission.js'
import { assertMissionCheckout } from './mission-checkout.js'
import { inspectTree, safeStat } from './retention-files.js'
import { assertInactiveAttempts, retentionAttempts, matchesOwner } from './cache-retention.js'
import { missionChildOwners, retentionOwners } from './retention-owners.js'
import {
  commitExactDelivery,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusEntries,
  requireGitHead,
  synchronizeIndexPaths,
} from './git-delivery.js'

const hash = (value) => createHash('sha256').update(value).digest('hex')

export function failedMissionCheckpoint(specdevPath, mission) {
  let checkpoint
  try {
    checkpoint = readCheckpoint(specdevPath, mission.run_id)
  } catch (error) {
    throw new Error(
      `Mission ${mission.id} runtime ${mission.run_id} is missing or unreadable: ${error.message}. Recover the recorded failed runtime from its failure commit before handoff; foreground focus cannot recreate it.`
    )
  }
  if (
    checkpoint.rootGraph !== 'mission-lifecycle' ||
    checkpoint.status !== 'completed' ||
    checkpoint.position.graph !== 'mission-lifecycle' ||
    checkpoint.position.node !== 'failed' ||
    checkpoint.stack.length
  ) {
    throw new Error(
      `Mission ${mission.id} runtime is not terminal at failed. Recover the exact failure checkpoint before handoff; do not activate an older checkpoint.`
    )
  }
  return checkpoint
}

// Handoff releases selection, not history. A successor owns a different run.
export async function releaseFailedMissionFocus({ specdevPath, mission }) {
  failedMissionCheckpoint(specdevPath, mission)
  const owners = await retentionOwners(specdevPath)
  const matches = owners.filter(
    (item) => item.state?.run_id === mission.run_id && !item.state?.mission
  )
  if (
    matches.length !== 1 ||
    matches[0].owner.mission !== mission.id ||
    matches[0].status !== 'failed'
  )
    throw new Error(
      `Ambiguous failed Mission runtime owner: ${mission.run_id}; resolve ownership before handoff`
    )
  const children = await missionChildOwners(specdevPath, mission.id)
  const attempts = (await retentionAttempts(specdevPath)).filter((attempt) =>
    [{ mission: mission.id }, ...children].some((owner) => matchesOwner(attempt, owner))
  )
  await assertInactiveAttempts(specdevPath, attempts)
  const runtime = readCurrent(specdevPath).focusedRunId
  if (runtime && runtime !== mission.run_id)
    throw new Error(
      `Runtime focus belongs to ${runtime}; finish or suspend that workflow before Mission ${mission.id} handoff`
    )
  const foreground = await readCurrentFocus(specdevPath)
  const owned =
    foreground &&
    ((foreground.kind === 'mission' && foreground.id === mission.id) ||
      (foreground.kind === 'assignment' &&
        children.some((owner) => owner.assignment.split('_')[0] === foreground.id)))
  if (foreground && !owned)
    throw new Error(
      `Foreground focus belongs to ${foreground.kind} ${foreground.id}; select Mission ${mission.id} before handoff`
    )
  if (runtime === mission.run_id) writeCurrent(specdevPath, { focusedRunId: null })
  if (owned) await clearCurrent(specdevPath)
}

export async function publishMissionFailure(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  await assertMissionCheckout(targetDir, mission, { containment: false })
  failedMissionCheckpoint(specdevPath, mission)
  const ownPath = relative(targetDir, join(missionPath, 'mission.yaml'))
  const runtimeRoot = join(specdevPath, '.ripplegraph', 'runs', mission.run_id)
  if (!mission.failure_publication) {
    const files = {}
    for (const file of [
      ...inspectTree(specdevPath, missionPath),
      ...inspectTree(specdevPath, runtimeRoot),
    ]) {
      const path = relative(targetDir, file.path)
      if (path !== ownPath) files[path] = hash(await fse.readFile(file.path))
    }
    const dirty = new Set((await gitStatusEntries(targetDir)).map((entry) => entry.path))
    const record = {
      version: 1,
      parent: await requireGitHead(targetDir),
      mission_hash: hash(stringify(mission, { lineWidth: 0 })),
      files,
      paths: [...Object.keys(files).filter((path) => dirty.has(path)), ownPath].sort(),
    }
    mission.failure_publication = { ...record, digest: hash(JSON.stringify(record)) }
    await writeMission(missionPath, mission)
  }
  const { digest, ...record } = mission.failure_publication
  if (hash(JSON.stringify(record)) !== digest)
    throw new Error('Mission failure publication record changed')
  const allowedRoots = [
    relative(targetDir, missionPath) + '/',
    relative(targetDir, runtimeRoot) + '/',
  ]
  if (
    !record.paths.includes(ownPath) ||
    [...record.paths, ...Object.keys(record.files)].some(
      (path) =>
        path.split('/').includes('..') || !allowedRoots.some((root) => path.startsWith(root))
    )
  )
    throw new Error('Mission failure publication has an unauthorized path')
  const { failure_publication, ...originalMission } = mission
  if (hash(stringify(originalMission, { lineWidth: 0 })) !== record.mission_hash)
    throw new Error(
      'Prepared Mission failure state changed; restore the original failure state before retrying'
    )
  const files = { ...record.files, [ownPath]: hash(stringify(mission, { lineWidth: 0 })) }
  const verify = async () => {
    for (const [path, expected] of Object.entries(files)) {
      if (
        !safeStat(specdevPath, join(targetDir, path))?.isFile() ||
        hash(await fse.readFile(join(targetDir, path))) !== expected
      )
        throw new Error(
          `Mission failure record changed: ${path}; restore the prepared record before retrying`
        )
    }
  }
  await verify()
  interrupt(context, 'failure-prepared')
  let commit = await findCommitByTrailer(targetDir, 'SpecDev-Failure', digest, { revision: 'HEAD' })
  if (!commit) {
    if ((await requireGitHead(targetDir)) !== record.parent)
      throw new Error(`Mission failure publication HEAD changed; retry on ${record.parent}`)
    const result = await commitExactDelivery(targetDir, {
      expectedHead: record.parent,
      paths: record.paths,
      subject: `specdev(mission): record ${mission.id} failure`,
      trailers: {
        'SpecDev-Mission': mission.id,
        'SpecDev-Commit-Type': 'failure',
        'SpecDev-Failure': digest,
      },
      finalizeDraft: verify,
    })
    commit = result.commit
    interrupt(context, 'failure-committed')
  }
  if (
    (await firstParent(targetDir, commit)) !== record.parent ||
    JSON.stringify(await gitChangedPathsAtCommit(targetDir, commit)) !==
      JSON.stringify(record.paths)
  )
    throw new Error('Mission failure commit does not match its prepared boundary')
  if ((await requireGitHead(targetDir)) === commit)
    await synchronizeIndexPaths(targetDir, record.paths, commit)
  return { commit, disposition: mission.disposition, verified: false }
}

function interrupt(context, phase) {
  if (context.flags?.['interrupt-after'] === phase)
    throw new Error(
      `simulated interruption after ${phase}; retry specdev mission run ${context.mission.id}`
    )
}
