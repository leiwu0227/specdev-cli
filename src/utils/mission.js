import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import fse from 'fs-extra'
import { parse, stringify } from 'yaml'
import { ASSIGNMENT_KINDS } from './assignment-vnext.js'
import { reserveEntityId } from './id-reservation.js'
import { normalizeMissionWaves } from './mission-waves.js'

export function parseMissionId(name) {
  return name.match(/^(M\d{5})_(.+)$/)?.slice(1) || null
}

export async function resolveMissionSelector(specdevPath, selector) {
  const wanted = String(selector || '').trim()
  if (!/^M\d{5}(?:_[^/\\]+)?$/.test(wanted)) return null
  const root = join(specdevPath, 'missions')
  if (!(await fse.pathExists(root))) return null
  const exact = join(root, wanted)
  if ((await fse.pathExists(exact)) && (await fse.stat(exact)).isDirectory()) {
    return { id: wanted.slice(0, 6), name: wanted, path: exact }
  }
  if (wanted.includes('_')) return null
  const matches = (await fse.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${wanted.slice(0, 6)}_`))
    .map((entry) => entry.name)
  if (matches.length !== 1) return matches.length > 1 ? { ambiguous: true, matches } : null
  return { id: wanted.slice(0, 6), name: matches[0], path: join(root, matches[0]) }
}

export async function readMission(missionPath) {
  return readYaml(join(missionPath, 'mission.yaml'))
}

export async function writeMission(missionPath, value) {
  return writeYamlAtomic(join(missionPath, 'mission.yaml'), value)
}

export async function readMissionQueue(missionPath) {
  return readYaml(join(missionPath, 'design', 'assignments.yaml'))
}

export async function writeMissionQueue(missionPath, value) {
  await fse.ensureDir(join(missionPath, 'design'))
  return writeYamlAtomic(join(missionPath, 'design', 'assignments.yaml'), value)
}

export async function validateAndReserveReplannedQueue(specdevPath, original, revised) {
  if (!revised || !Array.isArray(revised.assignments))
    throw new Error('Mission replanning must preserve an assignments list')
  if (!isDeepStrictEqual(revised.final_verification, original.final_verification)) {
    throw new Error('Mission replanning may not change final_verification')
  }
  const originalById = new Map(original.assignments.map((item) => [item.id, item]))
  const revisedIds = revised.assignments.filter((item) => item.id).map((item) => item.id)
  if (new Set(revisedIds).size !== revisedIds.length)
    throw new Error('Mission replanning produced duplicate Assignment IDs')
  const revisedById = new Map(
    revised.assignments.filter((item) => item.id).map((item) => [item.id, item])
  )
  for (const item of original.assignments) {
    const candidate = revisedById.get(item.id)
    if (!candidate) throw new Error(`Mission replanning removed existing Assignment ${item.id}`)
    if (
      ['completed', 'integrated', 'running', 'blocked', 'cancelled'].includes(item.status) &&
      !isDeepStrictEqual(candidate, item)
    ) {
      throw new Error(`Mission replanning changed protected Assignment ${item.id}`)
    }
    if (item.status === 'pending' && candidate.status !== 'pending') {
      throw new Error(`Mission replanning changed pending Assignment status ${item.id}`)
    }
  }

  const originalWaveById = new Map(
    original.assignments.map((item, index) => [item.id, Number(item.wave) || index + 1])
  )
  let nextWave = Math.max(0, ...originalWaveById.values()) + 1
  const normalizedRevised = normalizeMissionWaves(
    revised.assignments.map((item) => ({
      ...item,
      wave: item.id ? originalWaveById.get(item.id) : nextWave++,
    }))
  )
  const assignments = []
  for (const item of normalizedRevised) {
    const title = String(item.title || '').trim()
    const kind = item.kind || 'change'
    if (!title) throw new Error('Every replanned Assignment requires a title')
    if (!ASSIGNMENT_KINDS.includes(kind)) {
      throw new Error(
        `Invalid replanned Assignment kind: ${kind}. Valid kinds: ${ASSIGNMENT_KINDS.join(', ')}`
      )
    }
    if (item.id) {
      if (!originalById.has(item.id))
        throw new Error('Mission workers may not allocate new Assignment IDs')
      assignments.push(
        ['completed', 'integrated', 'running', 'blocked', 'cancelled'].includes(item.status)
          ? item
          : { id: item.id, title, kind, wave: item.wave, status: 'pending' }
      )
    } else {
      if (item.status && item.status !== 'pending')
        throw new Error('New replanned Assignments must have status: pending')
      assignments.push({
        id: await reserveEntityId(specdevPath, 'assignment'),
        title,
        kind,
        wave: item.wave,
        status: 'pending',
      })
    }
  }
  if (!assignments.some((item) => item.status === 'pending')) {
    throw new Error('Mission replanning must leave at least one pending Assignment')
  }
  return {
    version: 2,
    design_mode: 'replanned',
    assignments,
    final_verification: original.final_verification,
  }
}

async function readYaml(path) {
  if (!(await fse.pathExists(path))) return null
  const value = parse(await fse.readFile(path, 'utf-8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid YAML mapping: ${path}`)
  }
  return value
}

async function writeYamlAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeFile(temporary, stringify(value, { lineWidth: 0 }), 'utf-8')
  await fse.move(temporary, path, { overwrite: true })
  return value
}
