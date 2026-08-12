import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import fse from 'fs-extra'
import { parse, stringify } from 'yaml'
import { ASSIGNMENT_KINDS } from './assignment-vnext.js'
import { reserveEntityId } from './id-reservation.js'
import { parseResultEnvelope } from './result-envelope.js'
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

export function verificationReceiptsRequireFollowUp(receipts) {
  const latestByObligation = new Map()
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (!['passed', 'failed'].includes(receipt?.status)) continue
    const obligation = JSON.stringify([receipt.command, receipt.revision])
    latestByObligation.set(obligation, receipt.status)
  }
  return [...latestByObligation.values()].some((status) => status === 'failed')
}

export async function missionChildFollowUp(specdevPath, child) {
  if (!child.folder) return 'none'
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  const implementationPath = join(assignmentPath, 'implementation')
  const progress = await fse.readJson(join(implementationPath, 'progress.json')).catch(() => null)
  const findings = normalizeMissionFindings(progress?.findings)
  if (findings.some((finding) => finding.status === 'open')) return 'required'
  if (progress?.follow_up === 'required') return 'required'
  for (const name of ['worker-result.md', 'repair-result.md']) {
    const path = join(implementationPath, name)
    if (!(await fse.pathExists(path))) continue
    const result = parseResultEnvelope(await fse.readFile(path, 'utf-8'), 'worker')
    if (result.frontmatter.follow_up === 'required') return 'required'
  }
  if (verificationReceiptsRequireFollowUp(progress?.verification)) return 'required'
  const outcome = await fse.readFile(join(assignmentPath, 'outcome.md'), 'utf-8').catch(() => '')
  if (/^\|[^\n]*\|\s*(Failed|Blocked)\s*\|\s*$/im.test(outcome)) return 'required'
  return 'none'
}

export function missionChildDisposition(child) {
  if (child.review_disposition === 'approved-with-user-reapproval') {
    return 'approved-with-user-reapproval'
  }
  return child.execution === 'evidence-only' && child.follow_up === 'required'
    ? 'completed-with-follow-up'
    : 'completed'
}

export async function missionChildFindings(specdevPath, child) {
  if (!child.folder) return []
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  const progress = await fse
    .readJson(join(assignmentPath, 'implementation', 'progress.json'))
    .catch(() => null)
  const declared = normalizeMissionFindings(progress?.findings)
  if (declared.length > 0) return declared
  const outcome = await fse.readFile(join(assignmentPath, 'outcome.md'), 'utf-8').catch(() => '')
  return [...outcome.matchAll(/^\|\s*(AC-\d+)\s*\|[^\n]*\|\s*(Failed|Blocked)\s*\|\s*$/gim)].map(
    (match) => ({
      acceptance: match[1].toUpperCase(),
      type: match[2].toLowerCase() === 'blocked' ? 'evidence' : 'product',
      status: 'open',
      required: `Resolve ${match[1].toUpperCase()} from ${child.id}.`,
      supersedes: [],
    })
  )
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
          : {
              id: item.id,
              title,
              kind,
              wave: item.wave,
              status: 'pending',
              ...(originalById.get(item.id).gap_id
                ? { gap_id: originalById.get(item.id).gap_id }
                : {}),
              ...(originalById.get(item.id).gap_stage
                ? { gap_stage: originalById.get(item.id).gap_stage }
                : {}),
            }
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

export function bindReplannedQueueToGap(original, revised, { gapId, stage }) {
  const originalIds = new Set((original.assignments || []).map((item) => item.id))
  const added = (revised.assignments || []).filter((item) => !originalIds.has(item.id))
  if (added.length !== 1) {
    throw new Error(`Mission gap ${gapId} resolution must add exactly one focused Assignment`)
  }
  added[0].gap_id = gapId
  added[0].gap_stage = stage
  return added[0]
}

export function assertMissionTransitionRecorded(stepped, node, action = 'record') {
  if (!stepped.synchronized) {
    throw new Error(`Could not ${action} durable Mission transition from ${node}`)
  }
  if (stepped.state?.status === 'validation_error') {
    throw new Error(`Invalid durable Mission transition from ${node}`)
  }
  return stepped
}

function normalizeMissionFindings(value) {
  if (!Array.isArray(value)) return []
  return value.map((finding, index) => {
    const acceptance = String(finding?.acceptance || '')
      .trim()
      .toUpperCase()
    const type = String(finding?.type || '').trim()
    const status = String(finding?.status || 'open').trim()
    if (!/^AC-\d+$/.test(acceptance)) {
      throw new Error(`Invalid Mission finding acceptance at index ${index}: ${acceptance}`)
    }
    if (!type) throw new Error(`Mission finding type is required at index ${index}`)
    if (!['open', 'closed', 'superseded'].includes(status)) {
      throw new Error(`Invalid Mission finding status at index ${index}: ${status}`)
    }
    return {
      acceptance,
      type,
      status,
      required: String(finding.required || '').trim() || null,
      evidence: String(finding.evidence || '').trim() || null,
      supersedes: Array.isArray(finding.supersedes)
        ? finding.supersedes.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
    }
  })
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
