import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { writeCurrent, clearCurrent } from '../utils/current.js'
import { scanAssignments } from '../utils/scan.js'
import { readSessionState, clearSessionState } from '../utils/session-state.js'

export async function focusCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.clear) {
    await clearCurrent(specdevPath)
    // Clearing the active assignment invalidates any sticky session-state.
    await clearSessionState(specdevPath)
    if (flags.json) {
      console.log(JSON.stringify({ command: 'focus', version: 1, status: 'ok', cleared: true }))
    } else {
      console.log('Cleared active assignment.')
    }
    return
  }

  const selector = positionalArgs[0]
  if (!selector) {
    console.error('Missing assignment ID')
    console.log('   Usage: specdev focus <id>')
    console.log('   Usage: specdev focus --clear')
    process.exitCode = 1
    return
  }

  const resolved = await resolveAssignmentSelector(specdevPath, selector)
  if (!resolved) {
    const assignments = await scanAssignments(specdevPath)
    console.error(`Assignment not found: ${selector}`)
    if (assignments.length > 0) {
      console.log('   Available:')
      for (const a of assignments) {
        console.log(`   - ${a.name}`)
      }
    }
    process.exitCode = 1
    return
  }

  if (resolved.ambiguous) {
    console.error(`Assignment ID is ambiguous: ${selector}`)
    console.log(`   Matches: ${resolved.matches.join(', ')}`)
    process.exitCode = 1
    return
  }

  await writeCurrent(specdevPath, resolved.name)
  // Cross-assignment switch invalidates any sticky session-state whose
  // `assignment` field no longer matches the new `.current`.
  const existingSession = await readSessionState(specdevPath)
  if (existingSession && existingSession.assignment !== resolved.name) {
    await clearSessionState(specdevPath)
  }
  if (flags.json) {
    const id = resolved.name.split('_')[0]
    console.log(JSON.stringify({ command: 'focus', version: 1, status: 'ok', assignment_id: id, assignment_name: resolved.name, path: `.specdev/assignments/${resolved.name}` }))
  } else {
    console.log(`Focused on: ${resolved.name}`)
  }
}
