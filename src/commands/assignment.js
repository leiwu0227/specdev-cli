import { join } from 'path'
import fse from 'fs-extra'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { blankLine } from '../utils/output.js'
import { askChoice } from '../utils/prompt.js'
import { continueCommand } from './continue.js'
import { readBigPictureStatus } from '../utils/project-context.js'

export async function assignmentCommand(args = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  // Check big_picture.md is filled
  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists) {
    console.error('❌ big_picture.md not found')
    process.exitCode = 1
    return
  }
  if (!bigPicture.filled) {
    console.error('❌ big_picture.md is not filled in')
    console.log('   Run "specdev start" first to set up your project context')
    process.exitCode = 1
    return
  }

  // Determine next assignment ID
  const assignmentsDir = join(specdevPath, 'assignments')
  await fse.ensureDir(assignmentsDir)

  const existing = await fse.readdir(assignmentsDir)

  // Numeric-only labels are often an existing assignment ID (e.g. "00005")
  const label = args[0] || 'unnamed'
  if (/^\d+$/.test(label)) {
    const parsedId = Number.parseInt(label, 10)
    const matching = existing
      .filter((name) => {
        const id = Number.parseInt(name.match(/^(\d+)_/)?.[1] || '', 10)
        return id === parsedId
      })
      .sort()

    if (matching.length > 0) {
      const existingAssignment = matching[matching.length - 1]
      if (process.stdin.isTTY && process.stdout.isTTY) {
        const choice = await askChoice(
          `You entered a numeric label ("${label}"), and assignment ${existingAssignment} already exists. What do you want to do?`,
          [
            `Continue existing assignment (${existingAssignment})`,
            `Create a new assignment named "${label}"`,
            'Cancel',
          ]
        )

        if (choice === 0) {
          await continueCommand({ ...flags, assignment: existingAssignment })
          return
        }
        if (choice === 2) {
          console.log('Cancelled.')
          return
        }
      } else {
        console.error(`❌ Numeric label "${label}" matches existing assignment: ${existingAssignment}`)
        console.log(`   To continue existing work, run: specdev continue --assignment=${existingAssignment}`)
        console.log('   To create a new assignment, use a descriptive name (e.g. "auth-refactor").')
        process.exitCode = 1
        return
      }
    }
  }

  const ids = existing
    .map(name => Number.parseInt(name.match(/^(\d+)/)?.[1], 10))
    .filter(n => !isNaN(n))
  const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const paddedId = String(nextId).padStart(5, '0')

  // Build assignment name
  const dirName = `${paddedId}_feature_${label}`
  const assignmentPath = join(assignmentsDir, dirName)

  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.ensureDir(join(assignmentPath, 'context'))

  console.log(`✅ Assignment created: ${dirName}`)
  console.log(`   Path: ${assignmentPath}`)
  blankLine()
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  console.log(`   Write outputs to: ${dirName}/brainstorm/`)
}
