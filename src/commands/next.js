import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { computeNextAction } from '../utils/workflow-runtime.js'
import { printKeyValue } from '../utils/output.js'

export async function nextCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const payload = await computeNextAction(specdevPath)
  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log('SpecDev Next')
    if (payload.assignment) printKeyValue('Assignment', payload.assignment)
    printKeyValue('State', payload.state)
    if (payload.next_action) {
      printKeyValue('Action', payload.next_action.id)
      if (payload.next_action.command_line) {
        printKeyValue('Run', payload.next_action.command_line)
      }
      if (payload.next_action.guide) {
        printKeyValue('Guide', payload.next_action.guide)
      }
    }
    if (payload.trace?.length) {
      console.log('')
      console.log('Trace:')
      for (const item of payload.trace) console.log(`  - ${item}`)
    }
  }

  if (payload.status === 'blocked') process.exitCode = 1
}
