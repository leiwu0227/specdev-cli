import { execFile as callback } from 'node:child_process'
import { promisify } from 'node:util'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import fse from 'fs-extra'
import { readMissionQueue, resolveMissionSelector } from './mission.js'
import { findCommitsByTrailer, requireGitHead, currentGitBranch } from './git-delivery.js'

const execFile = promisify(callback)

export async function missionCheckout(targetDir) {
  const head = await requireGitHead(targetDir)
  const branch = await currentGitBranch(targetDir)
  if (!branch) throw new Error('Mission mutation requires an attached checkout; HEAD is detached')
  const { stdout } = await execFile('git', ['rev-parse', '--show-toplevel'], { cwd: targetDir })
  return { root: await realpath(stdout.trim()), head, branch }
}

export async function missionRevisionFacts(targetDir, mission) {
  const resolved = await resolveMissionSelector(join(targetDir, '.specdev'), mission.id)
  const queue =
    resolved?.path && (await fse.pathExists(join(resolved.path, 'design', 'assignments.yaml')))
      ? await readMissionQueue(resolved.path)
      : { assignments: [] }
  const revisions = new Set(
    [
      mission.base_revision || mission.created_revision,
      mission.last_checkpoint?.base_revision,
      mission.last_checkpoint?.revision,
      mission.final_revision,
      ...queue.assignments.flatMap((child) => [
        child.delivery_revision,
        child.integration_revision,
      ]),
      ...(await findCommitsByTrailer(targetDir, 'SpecDev-Mission', mission.id)),
    ].filter(Boolean)
  )
  const facts = []
  for (const revision of revisions) {
    let exists = false
    let contained = false
    try {
      await execFile('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: targetDir })
      exists = true
      await execFile('git', ['merge-base', '--is-ancestor', revision, 'HEAD'], { cwd: targetDir })
      contained = true
    } catch {
      /* Missing and unreachable revisions are factual inspection results. */
    }
    facts.push({ revision, exists, contained })
  }
  return facts
}

export async function assertMissionCheckout(targetDir, mission, { containment = true } = {}) {
  const checkout = await missionCheckout(targetDir)
  if (mission.checkout) {
    if (mission.checkout.root !== checkout.root) {
      throw new Error(
        `Mission checkout mismatch: recorded ${mission.checkout.root}; current ${checkout.root}`
      )
    }
  } else if (checkout.branch !== mission.branch) {
    // Old records have no worktree identity. Their recorded ref is the only
    // available authority; do not infer a different checkout during migration.
    throw new Error(
      `Legacy Mission checkout authority requires recorded identity ${mission.branch}`
    )
  }
  const revisions = await missionRevisionFacts(targetDir, mission)
  if (containment && (!revisions.length || revisions.some((fact) => !fact.contained))) {
    throw new Error(
      `Mission revisions are missing or unreachable: ${revisions
        .filter((fact) => !fact.contained)
        .map((fact) => fact.revision)
        .join(', ')}. Inspection and guarded abandonment remain available.`
    )
  }
  return { checkout, revisions }
}

export async function assertSequentialMission(missionPath, mission) {
  const queue = (await fse.pathExists(join(missionPath, 'design', 'assignments.yaml')))
    ? await readMissionQueue(missionPath)
    : { assignments: [] }
  const distributed = queue.assignments.filter(
    (child) =>
      child.branch ||
      child.integration ||
      child.workspace ||
      (child.delivery_revision && child.status !== 'integrated')
  )
  const running = queue.assignments.filter((child) => child.status === 'running')
  if (running.length > 1) {
    throw new Error(
      `Ambiguous concurrent Mission children: ${running.map((child) => child.id).join(', ')}. State is preserved; inspection and guarded abandonment remain available.`
    )
  }
  if (distributed.length || mission.pending_parallel_user_reapproval) {
    throw new Error(
      `Historical parallel Mission state is preserved and cannot advance: ${distributed.map((child) => `${child.id} (${child.delivery_revision || child.branch || child.workspace}; ${child.folder || missionPath})`).join(', ') || 'pending parallel reapproval'}. Inspection and guarded abandonment remain available; continuation requires a fresh approved work item.`
    )
  }
  return queue
}
