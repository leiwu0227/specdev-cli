import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { gitStatusPaths } from './git-delivery.js'

const execFile = promisify(execFileCallback)

export async function inspectMissionLanding(targetDir, mission, options = {}) {
  const finalRevision = String(options.finalRevision || mission.final_revision || '').trim()
  const baseBranch = String(mission.base_branch || '').trim()
  const missionBranch = String(mission.branch || '').trim()
  const common = {
    base_branch: baseBranch || null,
    mission_branch: missionBranch || null,
    final_revision: finalRevision || null,
  }

  if (!baseBranch || !missionBranch || !finalRevision) {
    return pending(common, mission, 'incomplete_record', {
      detail: 'The completed Mission does not have all recorded landing inputs.',
    })
  }
  if (!(await validLocalBranchName(targetDir, baseBranch))) {
    return pending(common, mission, 'invalid_base_branch', {
      detail: `Recorded base branch is not a valid local branch name: ${baseBranch}`,
    })
  }
  if (!(await validLocalBranchName(targetDir, missionBranch))) {
    return pending(common, mission, 'invalid_mission_branch', {
      detail: `Recorded Mission branch is not a valid local branch name: ${missionBranch}`,
    })
  }

  const [finalCommit, baseRevision, currentBranch, dirtyPaths] = await Promise.all([
    commitRevision(targetDir, finalRevision),
    branchRevision(targetDir, baseBranch),
    gitText(targetDir, ['branch', '--show-current']),
    gitStatusPaths(targetDir),
  ])
  const snapshot = {
    ...common,
    final_revision: finalCommit || finalRevision,
    base_revision: baseRevision,
    checked_out_branch: currentBranch || null,
    dirty_paths: dirtyPaths,
  }

  if (!finalCommit) {
    return pending(snapshot, mission, 'missing_final_revision', {
      detail: `Final Mission revision does not exist locally: ${finalRevision}`,
    })
  }
  if (!baseRevision) {
    return pending(snapshot, mission, 'missing_base_branch', {
      detail: `Recorded base branch does not exist locally: ${baseBranch}`,
    })
  }
  if (await isAncestor(targetDir, finalCommit, baseRevision)) {
    return {
      ...snapshot,
      status: 'already_landed',
      reason: baseRevision === finalCommit ? 'base_at_final' : 'base_contains_final',
      choices: [],
    }
  }

  const missionRevision = await branchRevision(targetDir, missionBranch)
  if (!missionRevision || !(await isAncestor(targetDir, finalCommit, missionRevision))) {
    return pending(snapshot, mission, 'mission_branch_mismatch', {
      mission_revision: missionRevision,
      detail: missionRevision
        ? `Mission branch ${missionBranch} does not contain final revision ${finalCommit}.`
        : `Mission branch does not exist locally: ${missionBranch}`,
    })
  }
  if (dirtyPaths.length > 0) {
    return pending(snapshot, mission, 'dirty_worktree', {
      detail: 'The worktree has tracked or untracked changes.',
    })
  }
  if (currentBranch !== missionBranch && currentBranch !== baseBranch) {
    return pending(snapshot, mission, 'wrong_branch', {
      detail: `Landing requires ${missionBranch}, or ${baseBranch} after an interrupted switch.`,
    })
  }
  if (!(await isAncestor(targetDir, baseRevision, finalCommit))) {
    return pending(snapshot, mission, 'diverged', {
      detail: `Base branch ${baseBranch} cannot fast-forward to ${finalCommit}.`,
    })
  }
  if (
    mission.base_revision &&
    mission.base_revision !== 'unborn' &&
    !(await isAncestor(targetDir, mission.base_revision, finalCommit))
  ) {
    return pending(snapshot, mission, 'diverged', {
      detail: `Final revision ${finalCommit} does not contain recorded base revision ${mission.base_revision}.`,
    })
  }

  return {
    ...snapshot,
    status: 'ready',
    reason: currentBranch === baseBranch ? 'resume_after_switch' : 'fast_forward',
    choices: landingChoices(mission),
  }
}

export async function landMission(targetDir, mission, options = {}) {
  const inspected = await inspectMissionLanding(targetDir, mission, options)
  if (inspected.status !== 'ready') return inspected

  if (inspected.checked_out_branch !== inspected.base_branch) {
    try {
      await gitRun(targetDir, ['switch', inspected.base_branch])
    } catch (error) {
      return pending(inspected, mission, 'switch_failed', { detail: error.message })
    }
  }

  const revalidated = await inspectMissionLanding(targetDir, mission, {
    finalRevision: inspected.final_revision,
  })
  if (revalidated.status === 'already_landed') return revalidated
  if (revalidated.status !== 'ready' || revalidated.checked_out_branch !== inspected.base_branch) {
    return revalidated.status === 'ready'
      ? pending(revalidated, mission, 'wrong_branch', {
          detail: `Git did not remain on base branch ${inspected.base_branch}.`,
        })
      : revalidated
  }

  try {
    await gitRun(targetDir, ['merge', '--ff-only', inspected.final_revision])
  } catch (error) {
    return pending(revalidated, mission, 'fast_forward_failed', { detail: error.message })
  }

  const completed = await inspectMissionLanding(targetDir, mission, {
    finalRevision: inspected.final_revision,
  })
  if (completed.status !== 'already_landed') {
    return pending(completed, mission, 'fast_forward_failed', {
      detail: `Base branch ${inspected.base_branch} did not reach ${inspected.final_revision}.`,
    })
  }
  return {
    ...completed,
    status: 'landed',
    reason: 'fast_forwarded',
  }
}

function pending(base, mission, reason, extra = {}) {
  return {
    ...base,
    ...extra,
    status: 'pending',
    reason,
    choices: landingChoices(mission),
  }
}

function landingChoices(mission) {
  const id = String(mission.id || '').trim()
  return [
    {
      action: 'inspect',
      command: 'git status --short && git log --oneline --decorate --graph --all',
    },
    {
      action: 'land',
      command: id ? `specdev mission land ${shellQuote(id)}` : 'specdev mission land <id>',
    },
    {
      action: 'leave',
      command: null,
    },
  ]
}

async function validLocalBranchName(targetDir, branch) {
  return gitSucceeds(targetDir, ['check-ref-format', '--branch', branch])
}

async function branchRevision(targetDir, branch) {
  return gitText(targetDir, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`])
}

async function commitRevision(targetDir, revision) {
  return gitText(targetDir, ['rev-parse', '--verify', `${revision}^{commit}`])
}

async function isAncestor(targetDir, ancestor, descendant) {
  return gitSucceeds(targetDir, ['merge-base', '--is-ancestor', ancestor, descendant])
}

async function gitText(targetDir, args) {
  try {
    return (await gitOutput(targetDir, args)).trim()
  } catch {
    return ''
  }
}

async function gitSucceeds(targetDir, args) {
  try {
    await execFile('git', args, { cwd: targetDir })
    return true
  } catch {
    return false
  }
}

async function gitOutput(targetDir, args) {
  const { stdout } = await execFile('git', args, {
    cwd: targetDir,
    encoding: 'utf-8',
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout
}

async function gitRun(targetDir, args) {
  try {
    await execFile('git', args, {
      cwd: targetDir,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim()
    throw new Error(`Git command failed: git ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
  }
}

function shellQuote(value) {
  if (/^[A-Za-z0-9._/-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}
