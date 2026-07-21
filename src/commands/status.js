import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { hasWorkspaceEngine } from '../utils/engine.js'
import { engineCommand } from './engine.js'

export async function statusCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  await requireSpecdevDirectory(join(targetDir, '.specdev'))
  if (!hasWorkspaceEngine(targetDir)) {
    console.error('SpecDev workflow registry is unavailable; run specdev update')
    process.exitCode = 1
    return
  }
  return engineCommand('status', [], flags)
}
