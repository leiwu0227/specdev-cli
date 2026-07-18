import { continueCommand } from './continue.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { hasWorkspaceEngine } from '../utils/engine.js'
import { shouldUseLegacyAssignmentRuntime } from '../utils/legacy-runtime.js'
import { engineCommand } from './engine.js'

export async function statusCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  if (
    hasWorkspaceEngine(targetDir) &&
    !(await shouldUseLegacyAssignmentRuntime(targetDir))
  ) {
    await engineCommand('status', [], flags)
    return
  }
  await continueCommand({
    ...flags,
    json: Boolean(flags.json),
    statusPayload: true,
    statusText: !flags.json,
  })
}
