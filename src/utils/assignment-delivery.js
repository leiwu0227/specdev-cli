import { join } from 'node:path'
import fse from 'fs-extra'
import {
  commitDelivery,
  currentGitBranch,
  findCommitByTrailer,
  gitStatusPaths,
  requireGitHead,
  stageOwnedChanges,
  summarizeGitPaths,
} from './git-delivery.js'
import { writeAssignmentStatus } from './assignment-vnext.js'
import { compactCompletedWorkflowRuntime, retireTransientArtifact } from './artifact-retention.js'
import { attemptActivitySummary } from './process-record.js'

export async function ensureAssignmentGitBoundary({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentStatus,
  adoptDirty = false,
}) {
  if (assignmentStatus?.mission) return { ok: true, skipped: 'mission_child' }

  const adhocPath = join(specdevPath, 'cache', 'adhoc.json')
  if (await fse.pathExists(adhocPath)) {
    return {
      ok: false,
      state: 'adhoc_active',
      next_action: 'Finish or cancel the active Adhoc before implementing an Assignment.',
    }
  }

  const currentHead = await requireGitHead(targetDir)
  if (assignmentStatus?.git_boundary?.starting_git_commit_hash) {
    if (currentHead !== assignmentStatus.git_boundary.starting_git_commit_hash) {
      return {
        ok: false,
        state: 'head_changed',
        starting_git_commit_hash: assignmentStatus.git_boundary.starting_git_commit_hash,
        current_git_commit_hash: currentHead,
        next_action:
          'Inspect the intervening commits and restore or deliberately restart the Assignment boundary; SpecDev will not silently absorb them.',
      }
    }
    return { ok: true, boundary: assignmentStatus.git_boundary, recovered: true }
  }

  const paths = await gitStatusPaths(targetDir)
  const projectPaths = paths.filter((path) => path !== '.specdev' && !path.startsWith('.specdev/'))
  if (projectPaths.length > 0 && !adoptDirty) {
    return {
      ok: false,
      state: 'dirty_worktree',
      working_tree: summarizeGitPaths(projectPaths),
      interaction: {
        question:
          'Product files already have changes. Decide whether they belong to this approved Assignment.',
        options: [
          { id: 'inspect', label: 'Stop and inspect', recommended: true },
          { id: 'checkpoint', label: 'Commit existing work separately, then rerun' },
          {
            id: 'adopt',
            label: 'Include every current product change in this Assignment',
            command: 'specdev implement --adopt-dirty',
          },
        ],
      },
    }
  }

  const boundary = {
    version: 1,
    starting_git_commit_hash: currentHead,
    starting_branch: await currentGitBranch(targetDir),
    starting_worktree: projectPaths.length > 0 ? 'adopted' : 'clean',
    adopted_path_count: projectPaths.length,
    established_at: new Date().toISOString(),
  }
  await writeAssignmentStatus(assignmentPath, { git_boundary: boundary })
  return { ok: true, boundary, recovered: false }
}

export async function finalizeStandaloneAssignmentDelivery({
  targetDir,
  assignmentPath,
  assignmentStatus,
}) {
  if (assignmentStatus?.mission) return null
  const id = String(assignmentStatus?.id || '').trim()
  if (!id) throw new Error('Assignment status has no durable ID')

  const recovered = await findCommitByTrailer(targetDir, 'SpecDev-Assignment', id, {
    revision: 'HEAD',
  })
  if (recovered) {
    return {
      starting_git_commit_hash: assignmentStatus.git_boundary?.starting_git_commit_hash || null,
      ending_git_commit_hash: recovered,
      recovered: true,
    }
  }

  const startingGitCommitHash = assignmentStatus.git_boundary?.starting_git_commit_hash
  if (!startingGitCommitHash) {
    throw new Error(
      'Assignment has no implementation Git boundary; rerun from implementation start'
    )
  }
  const currentHead = await requireGitHead(targetDir)
  if (currentHead !== startingGitCommitHash) {
    throw new Error(
      `Git HEAD changed during Assignment implementation (${startingGitCommitHash} -> ${currentHead}); inspect the intervening commit before delivery`
    )
  }

  await stageOwnedChanges(targetDir)
  const endingGitCommitHash = await commitDelivery(targetDir, {
    subject: `specdev(assignment): deliver ${id}`,
    trailers: {
      'SpecDev-Assignment': id,
      'SpecDev-Commit-Type': 'delivery',
    },
  })
  return {
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
    recovered: false,
  }
}

export async function completeStandaloneAssignmentDelivery({
  targetDir,
  specdevPath,
  assignmentPath,
}) {
  let status = await fse.readJson(join(assignmentPath, 'status.json'))
  if (status.mission) return null
  if (status.status !== 'completed') {
    throw new Error('Standalone Assignment cannot be delivered before completion')
  }

  const name = assignmentPath.split(/[/\\]/).pop()
  const activity =
    status.activity ||
    (await attemptActivitySummary(
      specdevPath,
      { assignment: name },
      {
        startedAt: status.approved_at || status.created_at,
        endedAt: status.completed_at,
      }
    ))
  if (!status.activity) status = await writeAssignmentStatus(assignmentPath, { activity })

  await retireTransientArtifact(
    targetDir,
    specdevPath,
    join(assignmentPath, 'implementation', 'worker-result.md')
  )
  await retireTransientArtifact(
    targetDir,
    specdevPath,
    join(assignmentPath, 'implementation', 'repair-result.md')
  )
  const runtime = await compactCompletedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: name },
    terminalOwner: { assignment: name, status: status.status },
    focus: { kind: 'assignment', id: status.id },
  })
  status = await writeAssignmentStatus(assignmentPath, {
    delivery_phase: 'ready',
    delivery_prepared_at: status.delivery_prepared_at || new Date().toISOString(),
  })
  const delivery = await finalizeStandaloneAssignmentDelivery({
    targetDir,
    assignmentPath,
    assignmentStatus: status,
  })
  return { activity, runtime_compaction: runtime, delivery }
}

export async function findPendingStandaloneAssignmentDelivery(targetDir, specdevPath) {
  const root = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(root))) return null
  const candidates = []
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(root, entry.name)
    const status = await fse.readJson(join(path, 'status.json')).catch(() => null)
    if (
      status?.status !== 'completed' ||
      status.mission ||
      !status.id ||
      !status.git_boundary?.starting_git_commit_hash
    ) {
      continue
    }
    if (
      !(await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, {
        revision: 'HEAD',
      }))
    ) {
      candidates.push({ path, status })
    }
  }
  if (candidates.length > 1) {
    throw new Error(
      `Multiple standalone Assignment deliveries need recovery: ${candidates.map((item) => item.status.id).join(', ')}`
    )
  }
  return candidates[0] || null
}
