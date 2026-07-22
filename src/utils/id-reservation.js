import { open, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import fse from 'fs-extra'

const COUNTER_FILE = '.id-counters.json'
const LOCK_SUBPATH = join('cache', 'id-allocator.lock')
const LOCK_STALE_MS = 60_000
const LOCK_WAIT_MS = 2_000
const LOCK_RETRY_MS = 25

const ENTITY_CONFIG = {
  assignment: { root: 'assignments', prefix: '', pattern: /^(\d+)_/, entryType: 'directory' },
  mission: { root: 'missions', prefix: 'M', pattern: /^M(\d+)_/, entryType: 'directory' },
  discussion: { root: 'discussions', prefix: 'D', pattern: /^D(\d+)_/, entryType: 'directory' },
  test_audit: { root: 'test-audits', prefix: 'TA', pattern: /^TA(\d+)_/, entryType: 'directory' },
  attempt: {
    root: 'processes',
    prefix: 'Attempt-',
    pattern: /^(?:Attempt|ATT)-(\d+)\.yaml$/,
    entryType: 'file',
  },
}

export async function reserveEntityId(specdevPath, kind) {
  const config = ENTITY_CONFIG[kind]
  if (!config) throw new Error(`unknown SpecDev entity kind: ${kind}`)

  const attemptNamespace =
    kind === 'attempt' ? normalizeAttemptNamespace(process.env.SPECDEV_ATTEMPT_NAMESPACE) : null

  return withAllocatorLock(specdevPath, async () => {
    const counters = await readCounters(specdevPath)
    const counterKey = attemptNamespace ? `attempt:${attemptNamespace}` : kind
    const effectiveConfig = attemptNamespace
      ? {
          ...config,
          prefix: `Attempt-${attemptNamespace}-`,
          pattern: new RegExp(`^(?:Attempt|ATT)-${attemptNamespace}-(\\d+)\\.yaml$`),
        }
      : config
    const scannedNext = await nextFromFolders(specdevPath, effectiveConfig)
    const nextNumber = Math.max(Number(counters.next[counterKey]) || 1, scannedNext)
    counters.next[counterKey] = nextNumber + 1
    await writeCounters(specdevPath, counters)
    return `${effectiveConfig.prefix}${String(nextNumber).padStart(5, '0')}`
  })
}

function normalizeAttemptNamespace(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (!/^\d{5}$/.test(text)) throw new Error('invalid SpecDev Attempt namespace')
  return text
}

async function readCounters(specdevPath) {
  const counterPath = join(specdevPath, COUNTER_FILE)
  if (!(await fse.pathExists(counterPath))) {
    return { version: 1, next: {} }
  }
  try {
    const parsed = await fse.readJson(counterPath)
    if (parsed?.version === 1 && parsed.next && typeof parsed.next === 'object') {
      return parsed
    }
  } catch {
    // Report a deterministic error rather than silently reusing an ID.
  }
  throw new Error(`invalid SpecDev ID counter: ${counterPath}`)
}

async function writeCounters(specdevPath, counters) {
  const counterPath = join(specdevPath, COUNTER_FILE)
  const temporaryPath = `${counterPath}.tmp-${process.pid}`
  await fse.writeJson(temporaryPath, counters, { spaces: 2 })
  await fse.move(temporaryPath, counterPath, { overwrite: true })
}

async function nextFromFolders(specdevPath, config) {
  const root = join(specdevPath, config.root)
  if (!(await fse.pathExists(root))) return 1
  const entries = await fse.readdir(root, { withFileTypes: true })
  const numbers = entries
    .filter((entry) => (config.entryType === 'file' ? entry.isFile() : entry.isDirectory()))
    .map((entry) => Number(entry.name.match(config.pattern)?.[1]))
    .filter((value) => Number.isInteger(value) && value > 0)
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
}

async function withAllocatorLock(specdevPath, callback) {
  const lockPath = join(specdevPath, LOCK_SUBPATH)
  await fse.ensureDir(join(specdevPath, 'cache'))
  const deadline = Date.now() + LOCK_WAIT_MS
  let handle

  while (!handle) {
    try {
      handle = await open(lockPath, 'wx')
      try {
        await handle.writeFile(
          JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })
        )
      } catch (error) {
        await handle.close().catch(() => {})
        handle = null
        await unlink(lockPath).catch(() => {})
        throw error
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (await isStaleLock(lockPath)) {
        await unlink(lockPath).catch(() => {})
        continue
      }
      if (Date.now() >= deadline) {
        throw new Error('SpecDev ID allocator is busy; retry the command')
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }

  try {
    return await callback()
  } finally {
    await handle.close().catch(() => {})
    await unlink(lockPath).catch(() => {})
  }
}

async function isStaleLock(lockPath) {
  try {
    const info = await stat(lockPath)
    return Date.now() - info.mtimeMs > LOCK_STALE_MS
  } catch {
    return false
  }
}
