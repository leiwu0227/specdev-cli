import { join } from 'node:path'
import fse from 'fs-extra'
import { callDir } from 'ripplegraph'
import { attemptActivitySummary } from './process-record.js'
import { assertInactiveAttempts, cleanOwnedCache, retentionAttempts } from './cache-retention.js'
import { inspectTree, removeSafeTree, safeStat } from './retention-files.js'

export function discussionCompletions(specdevPath) {
  const dir = join(specdevPath, 'discussions')
  if (!safeStat(specdevPath, dir)) return []
  const records = []
  for (const entry of fse.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^D\d{4,5}_/.test(entry.name)) continue
    const path = join(dir, entry.name, 'completion.json')
    if (!safeStat(specdevPath, path)) continue
    const record = fse.readJsonSync(path)
    const id = entry.name.split('_')[0]
    if (
      record.version !== 1 ||
      record.id !== id ||
      record.state?.status !== 'completed' ||
      record.state.call?.id !== id ||
      record.state.call?.graphId !== 'discussion-lifecycle' ||
      !record.state.output?.artifact_hash
    )
      throw new Error(`invalid Discussion completion record: ${path}`)
    if (records.some((item) => item.id === id))
      throw new Error(`ambiguous Discussion completion record: ${id}`)
    records.push(record)
  }
  return records
}

export async function compactDiscussion(specdevPath, discussionPath, state) {
  const id = state.call?.id
  if (
    !/^D\d{4,5}$/.test(id || '') ||
    state.status !== 'completed' ||
    state.call.graphId !== 'discussion-lifecycle'
  )
    throw new Error('Discussion cleanup requires terminal authority')
  const owner = { discussion: id }
  const attempts = (await retentionAttempts(specdevPath)).filter(
    (attempt) => attempt.discussion === id
  )
  await assertInactiveAttempts(specdevPath, attempts)
  const runtime = callDir(specdevPath, id)
  inspectTree(specdevPath, runtime)
  const checkpointPath = join(runtime, 'checkpoint.json')
  if (
    safeStat(specdevPath, checkpointPath) &&
    (await fse.readJson(checkpointPath)).status !== 'completed'
  )
    throw new Error('cannot clean non-terminal Discussion runtime')
  const path = join(discussionPath, 'completion.json')
  const existing = discussionCompletions(specdevPath).find((item) => item.id === id)
  if (!existing) {
    const { outputArtifact, ...retainedState } = state
    const record = {
      version: 1,
      id,
      completed_at: new Date().toISOString(),
      state: retainedState,
      activity: await attemptActivitySummary(specdevPath, owner),
    }
    const temporary = `${path}.tmp-${process.pid}`
    safeStat(specdevPath, temporary)
    await fse.writeJson(temporary, record, { spaces: 2 })
    await fse.rename(temporary, path)
  } else if (JSON.stringify(existing.state.output) !== JSON.stringify(state.output)) {
    throw new Error('Discussion completion identity changed')
  }
  await cleanOwnedCache(specdevPath, owner)
  removeSafeTree(specdevPath, runtime)
  for (const attempt of attempts)
    removeSafeTree(specdevPath, join(specdevPath, 'processes', `${attempt.id}.yaml`))
  return { compacted: true, attempts_removed: attempts.length }
}
