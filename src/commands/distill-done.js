import { join } from 'path'
import fse from 'fs-extra'
import { scanAssignments, markCapturesProcessed, readProcessedCaptures } from '../utils/scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'

const BIG_PICTURE_WORD_LIMIT = 2000

export async function distillDoneCommand(positionalArgs = [], flags = {}) {
  const assignmentName = positionalArgs[0]

  if (!assignmentName) {
    console.error('Missing required assignment name')
    console.log('Usage: specdev distill done <assignment-name>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const knowledgePath = join(specdevPath, 'knowledge')

  // Verify assignment exists
  const assignments = await scanAssignments(specdevPath)
  const match = assignments.find(a => a.name === assignmentName)
  if (!match) {
    console.error(`Assignment not found: ${assignmentName}`)
    process.exitCode = 1
    return
  }

  // Validate big_picture.md word count (always enforced, even if already processed)
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    const wordCount = content.split(/\s+/).filter(Boolean).length
    if (wordCount > BIG_PICTURE_WORD_LIMIT) {
      console.error(`big_picture.md is ${wordCount} words (limit: ${BIG_PICTURE_WORD_LIMIT}). Trim and retry.`)
      process.exitCode = 1
      return
    }
  }

  // Validate feature_descriptions.md contains assignment name (always enforced)
  const featureDescPath = join(specdevPath, 'project_notes', 'feature_descriptions.md')
  if (await fse.pathExists(featureDescPath)) {
    const content = await fse.readFile(featureDescPath, 'utf-8')
    if (!content.includes(assignmentName)) {
      console.error(`Assignment ${assignmentName} not found in feature_descriptions.md. Add an entry and retry.`)
      process.exitCode = 1
      return
    }
  } else {
    console.error(`feature_descriptions.md not found. Create it with an entry for ${assignmentName} and retry.`)
    process.exitCode = 1
    return
  }

  // Check if already processed (after validation passes)
  const processedProject = await readProcessedCaptures(knowledgePath, 'project')
  const processedWorkflow = await readProcessedCaptures(knowledgePath, 'workflow')
  if (processedProject.has(assignmentName) && processedWorkflow.has(assignmentName)) {
    console.log(JSON.stringify({
      status: 'ok',
      message: 'Already processed.',
      marked: assignmentName,
    }, null, 2))
    return
  }

  // Mark as processed for both types
  await markCapturesProcessed(knowledgePath, 'project', [assignmentName])
  await markCapturesProcessed(knowledgePath, 'workflow', [assignmentName])

  console.log(JSON.stringify({
    status: 'ok',
    marked: assignmentName,
  }, null, 2))
}
