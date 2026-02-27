import { join } from 'path'
import { markCapturesProcessed } from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const VALID_TYPES = ['project', 'workflow']

export async function distillMarkCommand(positionalArgs = [], flags = {}) {
  const type = positionalArgs[0]
  const assignmentList = positionalArgs[1]

  if (!type) {
    console.error('Missing required type argument')
    console.log('Usage: specdev distill mark-processed <project|workflow> <assignment1,assignment2,...>')
    process.exitCode = 1
    return
  }

  if (!VALID_TYPES.includes(type)) {
    console.error(`Invalid type: ${type}`)
    console.log(`Valid types: ${VALID_TYPES.join(', ')}`)
    process.exitCode = 1
    return
  }

  if (!assignmentList) {
    console.error('Missing required assignment names')
    console.log('Usage: specdev distill mark-processed <project|workflow> <assignment1,assignment2,...>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')
  const assignments = assignmentList.split(',').map(s => s.trim()).filter(Boolean)

  await markCapturesProcessed(knowledgePath, type, assignments)

  console.log(JSON.stringify({
    status: 'ok',
    type,
    marked: assignments,
  }, null, 2))
}
