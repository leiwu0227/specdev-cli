import { retentionOwners } from './retention-owners.js'
import { execFile as callback } from 'node:child_process'
import { promisify } from 'node:util'
import { join, dirname } from 'node:path'
import fse from 'fs-extra'
import { parse } from 'yaml'
import { gitStatusEntries } from './git-delivery.js'

// Check before broad Assignment staging. A previous handoff or manual deletion
// must not let a successor commit loss of its failed predecessor's history.
export async function assertRetainedMissionRecords(targetDir) {
  const changes = await gitStatusEntries(targetDir)
  const deleted = changes
    .filter((entry) => entry.status.includes('D') || entry.role === 'source')
    .map((entry) => entry.path)
  if (!deleted.length) return
  const tracked = (
    await gitOutput(targetDir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', '.specdev/missions'])
  )
    .split('\n')
    .filter((path) => /^\.specdev\/missions\/M\d{5}_[^/]+\/mission.yaml$/.test(path))
  let owners
  const deletedRecords = new Map()
  async function deletedRecord(path, decode) {
    if (!deletedRecords.has(path))
      deletedRecords.set(path, decode(await gitOutput(targetDir, ['show', `HEAD:${path}`])))
    return deletedRecords.get(path)
  }
  for (const path of tracked) {
    const previous = parse(await gitOutput(targetDir, ['show', `HEAD:${path}`]))
    const current = await fse
      .readFile(join(targetDir, path), 'utf8')
      .then(parse)
      .catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
    const mission =
      current?.status === 'failed' ? current : previous?.status === 'failed' ? previous : null
    if (!mission) continue
    owners ??= await retentionOwners(join(targetDir, '.specdev'))
    const children = owners
      .filter((item) => item.state?.mission === mission.id)
      .map((item) => ({ folder: item.owner.assignment, ...item.state }))
    for (const entry of deleted.filter((entry) =>
      /^\.specdev\/assignments\/[^/]+\/status.json$/.test(entry)
    )) {
      const state = await deletedRecord(entry, JSON.parse)
      if (state.mission === mission.id) children.push({ ...state, folder: entry.split('/')[2] })
    }
    const roots = [
      dirname(path) + '/',
      `.specdev/.ripplegraph/runs/${mission.run_id}/`,
      ...children.flatMap((child) => [
        `.specdev/assignments/${child.folder}/`,
        `.specdev/.ripplegraph/runs/${child.run_id}/`,
      ]),
    ]

    const lost = deleted.filter((entry) => roots.some((root) => entry.startsWith(root)))
    for (const entry of deleted.filter((entry) =>
      /^\.specdev\/processes\/[^/]+\.yaml$/.test(entry)
    )) {
      const attempt = await deletedRecord(entry, parse)
      if (
        attempt?.mission === mission.id ||
        children.some((child) => [child.id, child.folder].includes(attempt?.assignment))
      )
        lost.push(entry)
    }
    if (lost.length)
      throw new Error(
        `Refusing deletion of failed Mission ${mission.id} records: ${lost.join(', ')}. Recover the predecessor history before successor delivery; a successor cannot authorize its removal.`
      )
  }
}

const execFile = promisify(callback)
async function gitOutput(targetDir, args) {
  const { stdout } = await execFile('git', args, { cwd: targetDir, encoding: 'utf8' })
  return stdout
}
