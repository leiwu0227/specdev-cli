import { join } from 'node:path'
import fse from 'fs-extra'
import { parse } from 'yaml'
import { safeStat, inspectTree } from './retention-files.js'
import { ownerDirectory } from './cache-retention.js'
import { getCallableCall, readCheckpoint, readCurrent, runDir } from 'ripplegraph'

export async function retentionOwners(specdevPath) {
  const owners = []
  for (const [kind, family, filename, pattern] of [
    ['assignment', 'assignments', 'status.json', /^\d{5}_[^/\\]+$/],
    ['mission', 'missions', 'mission.yaml', /^M\d{5}_[^/\\]+$/],
    ['discussion', 'discussions', 'completion.json', /^D\d{4,5}_[^/\\]+$/],
  ]) {
    const dir = join(specdevPath, family)
    if (!safeStat(specdevPath, dir)) continue
    for (const entry of await fse.readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !pattern.test(entry.name)) continue
      const path = join(dir, entry.name)
      const owner = { [kind]: kind === 'assignment' ? entry.name : entry.name.split('_')[0] }
      let state = null
      let error = null
      try {
        const source = join(path, filename)
        if (safeStat(specdevPath, source)) state = parse(await fse.readFile(source, 'utf8'))
        else if (
          kind === 'discussion' &&
          safeStat(
            specdevPath,
            join(specdevPath, '.ripplegraph', 'calls', owner.discussion, 'checkpoint.json')
          )
        ) {
          state = {
            version: 1,
            id: owner.discussion,
            state: getCallableCall({ workflowRoot: specdevPath, callId: owner.discussion }),
          }
        }
      } catch (cause) {
        error = cause.message
      }
      const status = kind === 'discussion' ? state?.state?.status : state?.status
      const identity = kind === 'assignment' ? entry.name.split('_')[0] : owner[kind]
      const matches = state?.id === identity
      const evidence =
        kind === 'discussion'
          ? state?.version === 1 &&
            state?.state?.call?.id === identity &&
            state?.state?.output?.artifact_hash
          : Boolean(state?.activity)
      const eligible = matches && Boolean(evidence) && ['completed', 'abandoned'].includes(status)
      owners.push({
        owner,
        key: ownerDirectory(owner),
        path,
        state,
        status,
        eligible,
        reason:
          error ||
          (!matches
            ? 'missing or mismatched durable owner'
            : !['completed', 'abandoned'].includes(status)
              ? `owner is ${status || 'active or unknown'}`
              : !evidence
                ? 'durable activity/completion evidence missing'
                : null),
      })
    }
  }
  const missions = owners.filter((item) => item.owner.mission)
  for (const item of owners) {
    if (owners.filter((other) => other.key === item.key).length > 1) {
      item.eligible = false
      item.reason = 'ambiguous durable owner'
    }
    if (item.owner.assignment && item.state?.mission) {
      const parent = missions.filter((mission) => mission.owner.mission === item.state.mission)
      item.parent = parent.length === 1 ? parent[0] : null
      item.eligible = false
      item.reason = item.parent
        ? 'retained until parent Mission cleanup'
        : 'missing or ambiguous parent Mission'
    }
  }
  return owners
}

export async function missionChildOwners(specdevPath, mission) {
  return (await retentionOwners(specdevPath))
    .filter((item) => item.owner.assignment && item.state?.mission === mission)
    .map((item) => item.owner)
}

export async function completedChildRuntimes(specdevPath, mission, parentRunId) {
  if (!mission) return []
  const children = (await retentionOwners(specdevPath)).filter(
    (item) =>
      item.owner.assignment && item.state?.mission === mission && item.status === 'completed'
  )
  const paths = []
  for (const child of children) {
    const id = child.state.run_id
    if (!id || id === parentRunId) continue
    const path = runDir(specdevPath, id)
    if (!safeStat(specdevPath, path)) continue
    if (readCurrent(specdevPath).focusedRunId === id)
      throw new Error('cannot clean focused Mission child runtime')
    inspectTree(specdevPath, path)
    if (
      safeStat(specdevPath, join(path, 'checkpoint.json')) &&
      readCheckpoint(specdevPath, id).status !== 'completed'
    )
      throw new Error('cannot clean non-terminal Mission child runtime')
    paths.push(path)
  }
  return [...new Set(paths)]
}
