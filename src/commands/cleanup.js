import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { cleanup } from '../utils/cleanup.js'

export async function cleanupCommand(positionalArgs = [], flags = {}) {
  try {
    if (positionalArgs.length || (flags.apply !== undefined && flags.apply !== true))
      throw new Error('Usage: specdev cleanup [--apply] [--json]')
    const specdevPath = join(resolveTargetDir(flags), '.specdev')
    await requireSpecdevDirectory(specdevPath)
    const result = await cleanup(specdevPath, { apply: flags.apply === true })
    if (flags.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(
        `Cleanup ${result.status}: ${result.candidates.length} eligible files, ${result.reclaimable_bytes} reclaimable bytes`
      )
      for (const file of result.candidates) console.log(`  ${file.path} (${file.bytes} bytes)`)
      for (const skip of result.skipped)
        console.log(`  Kept ${skip.path || JSON.stringify(skip.owner)}: ${skip.reason}`)
      for (const error of result.errors)
        console.log(`  Error ${JSON.stringify(error.owner)}: ${error.message}`)
      if (!flags.apply)
        console.log('Run specdev cleanup --apply to revalidate and remove eligible leftovers.')
      else console.log(`Removed ${result.removed.length} files.`)
    }
    if (result.errors.length) process.exitCode = 1
    return result
  } catch (error) {
    const result = { command: 'cleanup', version: 1, status: 'error', error: error.message }
    if (flags.json) console.log(JSON.stringify(result, null, 2))
    else console.error(error.message)
    process.exitCode = 1
    return result
  }
}
