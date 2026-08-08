import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveAssignmentSelector } from './assignment.js'
import { readCurrentFocus } from './current.js'

export async function readFocusedAssignmentLifecycle(specdevPath) {
  const focus = await readCurrentFocus(specdevPath)
  if (focus?.kind !== 'assignment') return null
  const resolved = await resolveAssignmentSelector(specdevPath, focus.id)
  if (!resolved || resolved.ambiguous) {
    return {
      kind: 'assignment',
      id: String(focus.id),
      lifecycle: 'unknown',
      problem: 'Focused Assignment artifacts are missing or ambiguous.',
      next_action: 'specdev focus --clear',
    }
  }
  const status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
  const lifecycle = assignmentLifecycle(status)
  return {
    kind: 'assignment',
    id: String(status?.id || focus.id),
    name: resolved.name,
    path: resolved.path,
    lifecycle,
    immutable: ['shelved', 'unsupported'].includes(lifecycle),
    status,
    next_action: assignmentLifecycleNextAction(status, lifecycle),
  }
}

export function assignmentLifecycle(status) {
  if (!status?.id || !status?.run_id) return 'unknown'
  if (['shelved', 'unsupported', 'abandoned', 'completed'].includes(status?.status))
    return status.status
  return 'active'
}

export function assignmentLifecycleNextAction(status, lifecycle = assignmentLifecycle(status)) {
  const id = String(status?.id || '').trim()
  if (lifecycle === 'shelved') return `specdev assignment --from-assignment=${id}`
  if (lifecycle === 'unsupported') return `specdev assignment --from-assignment=${id}`
  if (lifecycle === 'abandoned') return 'specdev assignment "<new objective>"'
  if (lifecycle === 'completed') return 'specdev assignment "<follow-on objective>"'
  if (lifecycle === 'unknown') return 'specdev focus --clear'
  return 'specdev next --json'
}
