import { join } from 'path'
import fse from 'fs-extra'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { buildWorkingMemory } from '../utils/working-memory.js'

export async function memoryCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0] || 'refresh'
  if (subcommand === 'refresh') return memoryRefreshCommand(flags)

  console.error(`Unknown memory subcommand: ${subcommand}`)
  console.log('Usage: specdev memory refresh')
  process.exitCode = 1
}

async function memoryRefreshCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const outputPath = join(specdevPath, 'project_notes', 'working_memory.md')
  const result = await buildWorkingMemory(specdevPath)
  await fse.ensureDir(join(specdevPath, 'project_notes'))
  await fse.writeFile(outputPath, result.content, 'utf-8')

  if (flags.json) {
    console.log(JSON.stringify({
      command: 'memory refresh',
      version: 1,
      status: 'ok',
      output_path: '.specdev/project_notes/working_memory.md',
      word_count: result.wordCount,
      word_limit: result.wordLimit,
      recent_assignments_limit: result.recentAssignmentsLimit,
    }, null, 2))
    return
  }

  console.log('Working memory refreshed: .specdev/project_notes/working_memory.md')
}
