import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { readCurrent, runDir, callDir } from 'ripplegraph'
import { retentionOwners, completedChildRuntimes } from './retention-owners.js'
import {
  ownerDirectory,
  matchesOwner,
  ownedCacheFiles,
  assertInactiveAttempts,
  retentionAttempts,
} from './cache-retention.js'
import { inspectTree, safeStat } from './retention-files.js'
import {
  compactCompletedWorkflowRuntime,
  compactShelvedWorkflowRuntime,
} from './artifact-retention.js'
import { compactDiscussion } from './discussion-completion.js'

export async function planCleanup(specdevPath) {
  const owners = await retentionOwners(specdevPath)
  const attempts = await retentionAttempts(specdevPath)
  const groups = []
  const skipped = []
  const accounted = new Set()
  for (const item of owners) {
    if (item.parent) continue
    const children = owners.filter((child) => child.parent === item)
    const ownerSet = [item.owner, ...children.map((child) => child.owner)]
    const ownedAttempts = attempts.filter((attempt) =>
      ownerSet.some((owner) => matchesOwner(attempt, owner))
    )
    let files = []
    try {
      files = await ownedCacheFiles(
        specdevPath,
        item.owner,
        ownedAttempts,
        children.map((child) => child.owner)
      )
      for (const file of files) accounted.add(file.path)
      if (!item.eligible) throw new Error(item.reason || 'owner is not eligible')
      await assertInactiveAttempts(specdevPath, ownedAttempts)
      const runtime = item.owner.discussion
        ? callDir(specdevPath, item.owner.discussion)
        : item.state?.run_id
          ? runDir(specdevPath, item.state.run_id)
          : null
      if (!runtime) throw new Error('durable run identity missing')
      const runtimeFiles = inspectTree(specdevPath, runtime)
      const checkpointPath = join(runtime, 'checkpoint.json')
      const checkpoint = safeStat(specdevPath, checkpointPath)
        ? await fse.readJson(checkpointPath)
        : null
      const expected = item.status === 'abandoned' ? 'abandoned' : 'completed'
      if (checkpoint && checkpoint.status !== expected)
        throw new Error('runtime is not terminal or conflicts with owner')
      if (!item.owner.discussion && readCurrent(specdevPath).focusedRunId === item.state.run_id)
        throw new Error('runtime is focused; finish its lifecycle command first')
      files.push(...runtimeFiles)
      for (const childPath of await completedChildRuntimes(
        specdevPath,
        item.owner.mission,
        item.state?.run_id
      ))
        files.push(...inspectTree(specdevPath, childPath))
      for (const attempt of ownedAttempts)
        files.push(
          ...inspectTree(specdevPath, join(specdevPath, 'processes', `${attempt.id}.yaml`))
        )
      files = [...new Map(files.map((file) => [file.path, file])).values()]
      for (const file of files) accounted.add(file.path)
      if (files.length) groups.push({ ...item, files })
    } catch (error) {
      skipped.push({
        owner: item.owner,
        paths: files.map((file) => repoPath(specdevPath, file.path)),
        reason: error.message,
      })
    }
  }
  // Only known disposable cache families are candidates. Shared configuration,
  // indexes, worktrees, and publication journals never enter the deletion set.
  for (const family of [
    'attempts',
    'processes',
    'retired-artifacts',
    'missions',
    'reviewer-continuations',
  ]) {
    await reportUnowned(join(specdevPath, 'cache', family))
  }
  async function reportUnowned(path) {
    try {
      const stat = safeStat(specdevPath, path)
      if (!stat) return
      if (stat.isDirectory()) {
        for (const name of await fse.readdir(path)) await reportUnowned(join(path, name))
      } else if (!accounted.has(path))
        skipped.push({
          path: repoPath(specdevPath, path),
          reason: 'ownership or terminal eligibility cannot be established',
        })
    } catch (error) {
      skipped.push({ path: repoPath(specdevPath, path), reason: error.message })
    }
  }
  return { groups, skipped }
}

export async function cleanup(specdevPath, { apply = false } = {}) {
  const plan = await planCleanup(specdevPath)
  const files = plan.groups.flatMap((group) => group.files)
  const result = {
    command: 'cleanup',
    version: 1,
    status: 'preview',
    candidates: files.map((file) => ({
      path: repoPath(specdevPath, file.path),
      bytes: file.bytes,
    })),
    reclaimable_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    skipped: plan.skipped,
    removed: [],
    errors: [],
  }
  if (!apply) return result
  result.status = 'completed'
  for (const group of plan.groups) {
    try {
      // Re-read durable authority, current focus, Attempts and file identities
      // immediately before each owner transaction; never reuse preview authority.
      const current = (await planCleanup(specdevPath)).groups.find(
        (item) => item.key === ownerDirectory(group.owner)
      )
      if (
        !current ||
        JSON.stringify(current.state) !== JSON.stringify(group.state) ||
        JSON.stringify(current.files) !== JSON.stringify(group.files)
      ) {
        result.skipped.push({
          owner: group.owner,
          reason: 'cleanup authority or candidate changed; preview again',
        })
        continue
      }
      if (group.owner.discussion)
        await compactDiscussion(specdevPath, group.path, current.state.state)
      else {
        const compact =
          group.status === 'completed'
            ? compactCompletedWorkflowRuntime
            : compactShelvedWorkflowRuntime
        await compact(specdevPath, {
          runId: group.state.run_id,
          attemptFilter: group.owner,
          terminalOwner: { ...group.owner, status: group.status },
        })
      }
      for (const file of group.files)
        if (!safeStat(specdevPath, file.path)) result.removed.push(repoPath(specdevPath, file.path))
    } catch (error) {
      result.status = 'partial'
      result.errors.push({ owner: group.owner, message: error.message })
      for (const file of group.files) {
        try {
          if (!safeStat(specdevPath, file.path))
            result.removed.push(repoPath(specdevPath, file.path))
        } catch {
          /* Reported through the owner error. */
        }
      }
    }
  }
  return result
}

function repoPath(specdevPath, path) {
  return `.specdev/${relative(specdevPath, path).split('\\').join('/')}`
}
