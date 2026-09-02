import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { readMission, resolveMissionSelector } from '../utils/mission.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { writeCurrentFocus, clearCurrent } from '../utils/current.js'
import {
  assignmentLifecycle,
  assignmentLifecycleNextAction,
} from '../utils/assignment-lifecycle.js'
import fse from 'fs-extra'

export async function focusCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  if (flags.clear) {
    await clearCurrent(specdevPath)
    return emit(flags, { command: 'focus', version: 2, status: 'ok', cleared: true })
  }

  const selector = String(positionalArgs[0] || '').trim()
  if (!selector) return fail(flags, 'Usage: specdev focus <Assignment|Mission|Discussion ID>')
  let kind
  let resolved
  if (/^M\d{5}/.test(selector)) {
    kind = 'mission'
    resolved = await resolveMissionSelector(specdevPath, selector)
  } else if (/^D\d{4,5}/.test(selector)) {
    kind = 'discussion'
    resolved = await resolveDiscussionSelector(specdevPath, selector)
    if (resolved) resolved.id = resolved.name.match(/^D\d{4,5}/)?.[0]
  } else {
    kind = 'assignment'
    resolved = await resolveAssignmentSelector(specdevPath, selector)
    if (resolved) resolved.id = resolved.name.match(/^\d+/)?.[0]
  }
  if (!resolved || resolved.ambiguous || resolved.error)
    return fail(flags, `Work item not found or ambiguous: ${selector}`)
  if (kind === 'mission') {
    const mission = await readMission(resolved.path).catch(() => null)
    if (mission?.status === 'abandoned') {
      return fail(flags, `Mission ${mission.id} is abandoned and immutable; it cannot be focused`)
    }
  }
  await writeCurrentFocus(specdevPath, { kind, id: resolved.id })
  const assignmentStatus =
    kind === 'assignment'
      ? await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
      : null
  const lifecycle = kind === 'assignment' ? assignmentLifecycle(assignmentStatus) : undefined
  return emit(flags, {
    command: 'focus',
    version: 2,
    status: 'ok',
    kind,
    id: resolved.id,
    name: resolved.name,
    path: resolved.path,
    ...(lifecycle
      ? {
          lifecycle,
          immutable: ['shelved', 'unsupported'].includes(lifecycle),
          next_action: assignmentLifecycleNextAction(assignmentStatus, lifecycle),
        }
      : {}),
  })
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(
      payload.cleared ? 'Cleared foreground focus.' : `Focused on ${payload.kind}: ${payload.name}`
    )
    if (payload.lifecycle && payload.lifecycle !== 'active') {
      console.log(`Lifecycle: ${payload.lifecycle}${payload.immutable ? ' (immutable)' : ''}`)
      console.log(`Next: ${payload.next_action}`)
    }
  }
  return payload
}

function fail(flags, message) {
  if (flags.json)
    console.log(JSON.stringify({ command: 'focus', version: 2, status: 'error', error: message }))
  else console.error(message)
  process.exitCode = 1
  return null
}
