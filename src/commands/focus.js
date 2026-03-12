import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { writeCurrent, clearCurrent } from '../utils/current.js'
import { scanAssignments } from '../utils/scan.js'

export async function focusCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.clear) {
    await clearCurrent(specdevPath)
    console.log('Cleared active assignment.')
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
  console.log(`Focused on: ${resolved.name}`)
}
