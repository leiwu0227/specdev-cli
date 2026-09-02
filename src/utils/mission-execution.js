import { execFile as execFileCallback } from 'node:child_process'
import { basename, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { parse as parseYaml } from 'yaml'
import { resolveAgentProfile } from './agent-profiles.js'

const execFile = promisify(execFileCallback)
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/
const EXECUTOR_ID = /^[a-z0-9][a-z0-9._-]*$/
const SAFE_FACT_KEYS = new Set([
  'class',
  'available',
  'capabilities',
  'services',
  'platforms',
  'runtimes',
  'secret_names',
])

export const CONVERGENCE_DISPOSITIONS = Object.freeze([
  'needs_product_change',
  'needs_evidence',
  'executor_unavailable',
  'user_decision_required',
  'contract_unsatisfiable',
  'objective_failure',
])

export function missionExecutionPolicyTemplate() {
  return `
## Mission execution policy

- Executor catalog: \`.specdev/executors.yaml\`
- Primary executor: managed-worker
- Alternate executors: none
- Required runtimes: none
- Required capabilities: none
- Required services: none
- Required platforms: current
- Required secrets: none
- Allowed bypasses: none
- Escalation: user-decision-required
`
}

export async function deriveMissionExecutionPolicy({
  specdevPath,
  contractContent,
  contractHash,
  verificationCommand,
  environment = process.env,
  platform = `${process.platform}-${process.arch}`,
}) {
  const declaration = parsePolicyDeclaration(contractContent)
  if (declaration.catalog !== '.specdev/executors.yaml') {
    throw new Error('Mission executor catalog must be `.specdev/executors.yaml`')
  }
  const catalog = await readExecutorCatalog(specdevPath, { platform })
  const profiles = Object.fromEntries(
    await Promise.all(
      ['worker', 'reviewer'].map(async (role) => {
        const profile = await resolveAgentProfile(specdevPath, role)
        return [
          role,
          {
            provider: profile.provider,
            model: profile.model,
            effort: profile.effort,
            filesystem: profile.filesystem,
            network: profile.network,
            timeout_ms: profile.timeout_ms,
          },
        ]
      })
    )
  )
  const executable = await resolveVerificationExecutable(verificationCommand)
  const approvedIds = [...new Set([declaration.primary, ...declaration.alternates].filter(Boolean))]
  const requirements = {
    capabilities: declaration.requiredCapabilities,
    runtimes: declaration.requiredRuntimes,
    services: declaration.requiredServices,
    platforms: declaration.requiredPlatforms.map((value) =>
      value === 'current' ? platform : value
    ),
    secret_names: declaration.requiredSecrets,
  }
  const executors = approvedIds.map((id) =>
    evaluateExecutor(id, catalog.executors[id], requirements, {
      environment,
      executable,
      currentPlatform: platform,
    })
  )
  const missingExecutors = approvedIds.filter((id) => !catalog.executors[id])
  const missing = [
    ...missingExecutors.map((id) => `executor:${id}`),
    ...executors.flatMap((executor) => executor.missing.map((item) => `${executor.id}:${item}`)),
  ]
  const bypassed = missing.filter((item) =>
    declaration.allowedBypasses.some((bypass) => item.endsWith(bypass) || item === bypass)
  )
  const unresolved = missing.filter((item) => !bypassed.includes(item))
  const routedExecutors = executors.map((executor) => ({
    ...executor,
    capable: executor.missing.every((item) => bypassed.includes(`${executor.id}:${item}`)),
  }))
  const capable = routedExecutors
    .filter((executor) => executor.capable)
    .map((executor) => executor.id)
  const legacy = !declaration.present
  const ready = capable.length > 0
  const blocking = ready ? [] : unresolved

  return {
    version: 1,
    contract_hash: contractHash,
    compatibility_mode: legacy ? 'legacy-managed-only' : 'declared',
    review_profiles: profiles,
    verification: {
      command: verificationCommand,
      executable,
    },
    requirements,
    approved_executors: approvedIds,
    approved_executor_classes: [
      ...new Set(executors.map((executor) => executor.class).filter(Boolean)),
    ],
    primary_executor: declaration.primary,
    alternate_executors: declaration.alternates,
    executors: routedExecutors,
    allowed_bypasses: declaration.allowedBypasses,
    escalation: declaration.escalation,
    preflight: {
      status: ready ? (bypassed.length > 0 ? 'ready-with-bypass' : 'ready') : 'decision-required',
      ready,
      capable_executors: capable,
      missing: [...new Set(blocking)],
      bypassed: [...new Set(bypassed)],
      decisions: blocking.map((requirement) => ({
        requirement,
        disposition: 'user_decision_required',
        action:
          `Declare an already-authorized capable executor, record an exact bypass for ${requirement}, ` +
          'or change the Mission contract before approval.',
      })),
    },
  }
}

export async function resolveMissionReviewerProfile({
  specdevPath,
  executionPolicy,
  stateProfile = null,
}) {
  const frozen = stateProfile || executionPolicy?.review_profiles?.reviewer
  if (!frozen) return resolveAgentProfile(specdevPath, 'reviewer')
  const profile = await resolveAgentProfile(specdevPath, 'reviewer', {
    provider: frozen.provider,
    model: frozen.model,
    effort: frozen.effort,
    network: frozen.network,
    timeout: frozen.timeout_ms,
  })
  if (frozen.filesystem && frozen.filesystem !== profile.filesystem) {
    throw new Error(
      `Frozen Mission reviewer filesystem policy ${frozen.filesystem} cannot be enforced by ${profile.provider}`
    )
  }
  return profile
}

export function parsePolicyDeclaration(content) {
  const section = contractSection(content, 'Mission execution policy')
  if (!section.trim()) {
    return {
      present: false,
      catalog: '.specdev/executors.yaml',
      primary: 'managed-worker',
      alternates: [],
      requiredCapabilities: [],
      requiredRuntimes: [],
      requiredServices: [],
      requiredPlatforms: [],
      requiredSecrets: [],
      allowedBypasses: [],
      escalation: 'user-decision-required',
    }
  }
  const value = (label, fallback = '') =>
    section.match(new RegExp(`^\\s*-\\s+${escapeRegExp(label)}:\\s*(.+?)\\s*$`, 'im'))?.[1] ||
    fallback
  const requiredSecrets = listValue(value('Required secrets', 'none'))
  for (const name of requiredSecrets) {
    if (!SECRET_NAME.test(name)) throw new Error(`Invalid required secret name: ${name}`)
  }
  return {
    present: true,
    catalog: stripTicks(value('Executor catalog', '.specdev/executors.yaml')),
    primary: identifier(value('Primary executor'), 'Primary executor'),
    alternates: listValue(value('Alternate executors', 'none')).map((entry) =>
      identifier(entry, 'Alternate executor')
    ),
    requiredCapabilities: listValue(value('Required capabilities', 'none')),
    requiredRuntimes: listValue(value('Required runtimes', 'none')),
    requiredServices: listValue(value('Required services', 'none')),
    requiredPlatforms: listValue(value('Required platforms', 'current')),
    requiredSecrets,
    allowedBypasses: listValue(value('Allowed bypasses', 'none')),
    escalation: stripTicks(value('Escalation', 'user-decision-required')),
  }
}

export async function readExecutorCatalog(
  specdevPath,
  { platform = `${process.platform}-${process.arch}` } = {}
) {
  const path = join(specdevPath, 'executors.yaml')
  if (!(await fse.pathExists(path))) {
    return {
      version: 1,
      compatibility: true,
      executors: {
        'managed-worker': {
          class: 'managed-worker',
          available: true,
          capabilities: [],
          services: [],
          platforms: [platform],
          runtimes: [],
          secret_names: [],
        },
      },
    }
  }
  let decoded
  try {
    decoded = parseYaml(await fse.readFile(path, 'utf-8'))
  } catch (error) {
    throw new Error(`Invalid executor catalog ${path}: ${error.message}`)
  }
  if (decoded?.version !== 1 || !mapping(decoded.executors)) {
    throw new Error(`Invalid executor catalog ${path}: expected version 1 and an executors mapping`)
  }
  const executors = {}
  for (const [id, raw] of Object.entries(decoded.executors)) {
    identifier(id, 'Executor ID')
    if (!mapping(raw)) throw new Error(`Invalid executor ${id}: expected a mapping`)
    const unsafe = Object.keys(raw).filter((key) => !SAFE_FACT_KEYS.has(key))
    if (unsafe.length > 0) {
      throw new Error(
        `Invalid executor ${id}: unsupported fields ${unsafe.join(', ')}; store capability facts and secret names only`
      )
    }
    const secretNames = stringList(raw.secret_names)
    for (const name of secretNames) {
      if (!SECRET_NAME.test(name))
        throw new Error(`Invalid secret name for executor ${id}: ${name}`)
    }
    executors[id] = {
      class: identifier(raw.class || id, `Executor ${id} class`),
      available: raw.available !== false,
      capabilities: normalizeCapabilities(raw.capabilities),
      services: stringList(raw.services),
      platforms: stringList(raw.platforms).map((value) => (value === 'current' ? platform : value)),
      runtimes: stringList(raw.runtimes),
      secret_names: secretNames,
    }
  }
  return { version: 1, compatibility: false, executors }
}

export function selectVerificationExecutor(policy, { currentClass } = {}) {
  const activeClass = String(currentClass || process.env.SPECDEV_EXECUTOR_CLASS || 'managed-worker')
  const ordered = [policy.primary_executor, ...(policy.alternate_executors || [])]
  const candidates = ordered
    .map((id) => policy.executors.find((executor) => executor.id === id))
    .filter(Boolean)
  const selected = candidates.find((executor) => executor.capable && executor.class === activeClass)
  if (selected) {
    return {
      status: selected.id === policy.primary_executor ? 'primary' : 'recovery',
      executor: selected,
      current_class: activeClass,
    }
  }
  const alternate = candidates.find((executor) => executor.capable)
  return {
    status: 'executor-unavailable',
    executor: null,
    current_class: activeClass,
    authorized_alternate: alternate || null,
    next_action: alternate
      ? `Resume on approved executor class ${alternate.class} with SPECDEV_EXECUTOR_CLASS=${alternate.class}.`
      : 'Amend and reapprove the Mission execution policy with a capable executor or an explicit bypass.',
  }
}

export function classifyVerificationDisposition({ exitCode, blocked = false }) {
  if (blocked || exitCode === 126 || exitCode === 127) return 'executor_unavailable'
  if (exitCode === 0) return 'needs_evidence'
  return 'needs_product_change'
}

export function appendVerificationReceipt(history, receipt) {
  const items = Array.isArray(history) ? structuredClone(history) : []
  const previous = items.at(-1)
  const next = { ...receipt }
  if (previous && next.status === 'passed' && previous.status !== 'passed') {
    next.supersedes = previous.id
    previous.superseded_by = next.id
  }
  items.push(next)
  return items
}

export function scopeMissionFinding(input, now = new Date().toISOString()) {
  const acceptance = String(input.acceptance || '').trim()
  const type = String(input.type || '').trim()
  if (!/^AC-\d+$/.test(acceptance))
    throw new Error(`Invalid Mission finding acceptance: ${acceptance}`)
  if (!type) throw new Error('Mission finding type is required')
  return {
    id: String(input.id || `${acceptance}:${type}`).trim(),
    acceptance,
    type,
    status: 'open',
    required: String(input.required || '').trim() || null,
    source: input.source || null,
    created_at: now,
    updated_at: now,
  }
}

export function closeOrSupersedeFinding(finding, input, now = new Date().toISOString()) {
  if (!finding || finding.status !== 'open')
    throw new Error('Only an open Mission finding can close')
  const mode = input.mode === 'superseded' ? 'superseded' : 'closed'
  return {
    ...finding,
    status: mode,
    updated_at: now,
    ...(mode === 'closed'
      ? { closed_at: now, closure_evidence: input.evidence }
      : {
          superseded_at: now,
          superseded_by: String(input.by || '').trim(),
          evidence: input.evidence,
        }),
  }
}

async function resolveVerificationExecutable(command) {
  const token = firstCommandToken(command)
  if (!token) return { requested: null, path: null, available: false }
  if (isAbsolute(token)) {
    const available = await fse.pathExists(token)
    return { requested: token, path: available ? token : null, available }
  }
  try {
    const { stdout } = await execFile('which', [token])
    const path = stdout.trim().split(/\r?\n/)[0] || null
    return { requested: token, path, name: path ? basename(path) : token, available: Boolean(path) }
  } catch {
    return { requested: token, path: null, name: token, available: false }
  }
}

function evaluateExecutor(id, facts, requirements, { environment, executable, currentPlatform }) {
  if (!facts) return { id, class: null, capable: false, missing: ['declaration'] }
  const missing = []
  if (!facts.available) missing.push('available')
  for (const capability of requirements.capabilities) {
    if (!facts.capabilities.includes(capability)) missing.push(`capability:${capability}`)
  }
  for (const runtime of requirements.runtimes) {
    if (!facts.runtimes.includes(runtime)) missing.push(`runtime:${runtime}`)
  }
  for (const service of requirements.services) {
    if (!facts.services.includes(service)) missing.push(`service:${service}`)
  }
  for (const platform of requirements.platforms) {
    if (!facts.platforms.includes(platform)) missing.push(`platform:${platform}`)
  }
  for (const name of requirements.secret_names) {
    if (!facts.secret_names.includes(name) || !Object.hasOwn(environment, name)) {
      missing.push(`secret:${name}`)
    }
  }
  if (!executable.available) missing.push(`executable:${executable.requested || 'unknown'}`)
  return {
    id,
    class: facts.class,
    available: facts.available,
    capable: missing.length === 0,
    observed_on: currentPlatform,
    capabilities: facts.capabilities,
    services: facts.services,
    platforms: facts.platforms,
    runtimes: facts.runtimes,
    secret_names: facts.secret_names,
    missing,
  }
}

function firstCommandToken(command) {
  const text = String(command || '').trim()
  if (!text || /^[A-Za-z_][A-Za-z0-9_]*=/.test(text)) return ''
  const quoted = text.match(/^(?:'([^']+)'|"([^"]+)"|([^\s;&|<>]+))/)
  return quoted?.[1] || quoted?.[2] || quoted?.[3] || ''
}

function contractSection(content, heading) {
  const escaped = escapeRegExp(heading)
  return (
    String(content || '').match(
      new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'mi')
    )?.[1] || ''
  )
}

function listValue(value) {
  const text = stripTicks(value).trim()
  if (!text || text.toLowerCase() === 'none') return []
  return text
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((entry) => stripTicks(entry).trim())
    .filter(Boolean)
}

function stringList(value) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('Executor list facts must be YAML arrays')
  return value.map((entry) => String(entry).trim()).filter(Boolean)
}

function normalizeCapabilities(value) {
  if (value == null) return []
  if (Array.isArray(value)) return stringList(value)
  if (!mapping(value)) throw new Error('Executor capabilities must be an array or mapping')
  return Object.entries(value)
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name)
}

function identifier(value, label) {
  const result = stripTicks(value).trim()
  if (!EXECUTOR_ID.test(result)) throw new Error(`${label} must be a lowercase executor identifier`)
  return result
}

function mapping(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stripTicks(value) {
  return String(value || '').replace(/^`|`$/g, '')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
