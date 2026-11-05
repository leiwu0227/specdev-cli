import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { cleanup } from '../utils/cleanup.js'

export async function cleanupCommand(positionalArgs = [], flags = {}) {
  try {
    if (
      positionalArgs.length ||
      (flags.apply !== undefined && flags.apply !== true) ||
      (flags['empty-calls'] !== undefined && flags['empty-calls'] !== true)
    )
      throw new Error('Usage: specdev cleanup [--empty-calls] [--apply] [--json]')
    const specdevPath = join(resolveTargetDir(flags), '.specdev')
    await requireSpecdevDirectory(specdevPath)
    const result = await cleanup(specdevPath, {
      apply: flags.apply === true,
      emptyCalls: flags['empty-calls'] === true,
    })
    if (flags.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(
        `Cleanup ${result.status}: ${result.candidates.length} eligible entries, ${result.reclaimable_bytes} reclaimable bytes`
      )
      for (const file of result.candidates) console.log(`  ${file.path} (${file.bytes} bytes)`)
      for (const skip of result.skipped)
        console.log(`  Kept ${skip.path || JSON.stringify(skip.owner)}: ${skip.reason}`)
      for (const error of result.errors)
        console.log(`  Error ${JSON.stringify(error.owner)}: ${error.message}`)
      if (!flags.apply)
        console.log(
          `Run specdev cleanup${flags['empty-calls'] ? ' --empty-calls' : ''} --apply to revalidate and remove eligible leftovers.`
        )
      else console.log(`Removed ${result.removed.length} entries.`)
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
