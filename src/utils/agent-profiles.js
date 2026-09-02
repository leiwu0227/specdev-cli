import { join } from 'node:path'
import fse from 'fs-extra'
import { parse } from 'yaml'
import { resolveProviderAccessPolicy } from './provider-adapters.js'

const ROLE_NAMES = new Set(['worker', 'reviewer'])
const TOP_LEVEL_NAMES = new Set([...ROLE_NAMES, 'implementation'])
const IMPLEMENTATION_MODES = new Set(['auto', 'inline', 'spawned'])
const PROVIDERS = new Set(['codex', 'claude', 'cursor'])
const DEFAULT_PROFILES = {
  worker: { provider: 'codex', model: 'gpt-5', effort: 'high', timeout: '60m' },
  reviewer: { provider: 'claude', model: 'opus', effort: 'high', timeout: '20m' },
}

export async function resolveAgentProfile(specdevPath, role, explicit = {}) {
  if (!ROLE_NAMES.has(role)) throw new Error(`unknown agent profile: ${role}`)
  const repository = await readAgentConfiguration(join(specdevPath, 'agents.yaml'))
  const local = await readAgentConfiguration(join(specdevPath, 'cache', 'agents.local.yaml'))
  const profile = {
    ...DEFAULT_PROFILES[role],
    ...(repository[role] || {}),
    ...(local[role] || {}),
    ...removeUndefined(explicit),
  }
  return validateProfile(role, profile)
}

export async function resolveImplementationMode(specdevPath) {
  const repository = await readAgentConfiguration(join(specdevPath, 'agents.yaml'))
  const local = await readAgentConfiguration(join(specdevPath, 'cache', 'agents.local.yaml'))
  return local.implementation?.mode ?? repository.implementation?.mode ?? 'auto'
}

export function validateProfile(role, profile) {
  const provider = String(profile.provider || '').trim()
  const model = nullableText(profile.model)
  const effort = nullableText(profile.effort)
  const network = profile.network ?? false
  if (!PROVIDERS.has(provider)) {
    throw new Error(`${role} profile provider must be codex, claude, or cursor`)
  }
  if (!model) throw new Error(`${role} profile model is required`)
  if (typeof network !== 'boolean') {
    throw new Error(`${role} profile network must be true or false`)
  }
  const accessPolicy = resolveProviderAccessPolicy({ profile: { provider, network }, role })

  const supportedEffort = {
    codex: new Set(['low', 'medium', 'high', 'xhigh']),
    claude: new Set(['low', 'medium', 'high', 'xhigh', 'max']),
    cursor: new Set(),
  }[provider]
  if (effort && !supportedEffort.has(effort)) {
    const suffix =
      supportedEffort.size > 0
        ? `; supported values: ${[...supportedEffort].join(', ')}`
        : '; this provider adapter does not support an effort setting'
    throw new Error(`${provider} does not support effort=${effort}${suffix}`)
  }

  return {
    provider,
    model,
    effort,
    filesystem: accessPolicy.filesystem,
    network: accessPolicy.network,
    timeout_ms: parseDuration(profile.timeout, `${role} timeout`),
  }
}

export function parseDuration(value, field = 'duration') {
  if (Number.isInteger(value) && value > 0) return value
  const match = String(value || '')
    .trim()
    .match(/^(\d+)(ms|s|m|h)$/)
  if (!match || Number(match[1]) <= 0) {
    throw new Error(`${field} must be a positive duration such as 30s, 20m, or 1h`)
  }
  const multiplier = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[match[2]]
  return Number(match[1]) * multiplier
}

export async function readAgentConfiguration(path) {
  if (!(await fse.pathExists(path))) return {}
  let decoded
  try {
    decoded = parse(await fse.readFile(path, 'utf-8'))
  } catch (error) {
    throw new Error(`invalid agent profiles ${path}: ${error.message}`)
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error(`invalid agent profiles ${path}: expected a YAML mapping`)
  }
  for (const [role, profile] of Object.entries(decoded)) {
    if (!TOP_LEVEL_NAMES.has(role)) {
      throw new Error(`invalid agent profile role in ${path}: ${role}`)
    }
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error(`invalid ${role} profile in ${path}: expected a mapping`)
    }
    if (role === 'implementation') {
      const fields = Object.keys(profile)
      if (fields.some((field) => field !== 'mode')) {
        throw new Error(`invalid implementation configuration in ${path}: only mode is supported`)
      }
      const mode = String(profile.mode ?? 'auto').trim()
      if (!IMPLEMENTATION_MODES.has(mode)) {
        throw new Error(
          `invalid implementation configuration in ${path}: mode must be auto, inline, or spawned`
        )
      }
      profile.mode = mode
    }
  }
  return decoded
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}
