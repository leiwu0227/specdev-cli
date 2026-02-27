import { join } from 'path'
import { resolveTargetDir } from '../utils/command-context.js'
import { readActiveTools, removeTool } from '../utils/active-tools.js'
import { removeWrappers } from '../utils/wrappers.js'

export async function skillsRemoveCommand(positionalArgs = [], flags = {}) {
  const name = positionalArgs[0]

  if (!name) {
    console.error('Missing required skill name')
    console.log('Usage: specdev skills remove <name>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')

  const activeTools = await readActiveTools(specdevPath)

  if (!activeTools.tools[name]) {
    console.error(`Tool skill "${name}" is not installed`)
    console.error(`Active tools: ${Object.keys(activeTools.tools).join(', ') || '(none)'}`)
    process.exitCode = 1
    return
  }

  // Remove wrappers
  const wrapperPaths = activeTools.tools[name].wrappers || []
  removeWrappers(targetDir, wrapperPaths)

  // Remove from active-tools.json
  await removeTool(specdevPath, name)

  console.log(`Removed ${name}`)
  for (const p of wrapperPaths) {
    console.log(`   x ${p}`)
  }
}
