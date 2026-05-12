import { join } from 'path'
import fse from 'fs-extra'
import { readCurrent } from './current.js'

/**
 * Sticky session-state protocol — see design.md §Layer 3.
 *
 * File: `.specdev/.session-state.json`
 *
 * Schema:
 *   {
 *     assignment: string,        // current assignment folder name
 *     reviewer: string,          // reviewer name(s); comma-separated when chained
 *     autocontinue: boolean,
 *     set_at: string,            // ISO timestamp
 *     set_by_step: string,       // manifest step id that wrote the record
 *   }
 *
 * Writer: `specdev reviewloop ... --autocontinue` only.
 * Readers: validate `state.assignment === <current assignment>`; stale records
 *   are treated as null (not auto-deleted; focus.js handles cross-assignment unlinking).
 * Clear: terminal-phase approval and assignment switch (focus.js).
 */

function sessionStatePath(specdevPath) {
  return join(specdevPath, '.session-state.json')
}

export async function writeSessionState(specdevPath, state) {
  if (!state || typeof state !== 'object') {
    throw new Error('writeSessionState requires an object state')
  }
  if (!state.assignment || typeof state.assignment !== 'string') {
    throw new Error('session-state.assignment is required')
  }
  await fse.ensureDir(specdevPath)
  await fse.writeJson(sessionStatePath(specdevPath), state, { spaces: 2 })
}

export async function readSessionState(specdevPath) {
  const path = sessionStatePath(specdevPath)
  if (!(await fse.pathExists(path))) return null
  try {
    return await fse.readJson(path)
  } catch {
    return null
  }
}

export async function clearSessionState(specdevPath) {
  const path = sessionStatePath(specdevPath)
  if (await fse.pathExists(path)) {
    await fse.remove(path)
  }
}

/**
 * Read session-state and validate it matches the current assignment from
 * `.specdev/.current`. Returns null on missing file, parse error, or mismatch.
 */
export async function readValidatedSessionState(specdevPath) {
  const state = await readSessionState(specdevPath)
  if (!state) return null
  const current = await readCurrent(specdevPath)
  if (!current || state.assignment !== current) return null
  return state
}
