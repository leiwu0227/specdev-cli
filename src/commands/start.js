import { join } from 'path'
import fse from 'fs-extra'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { blankLine } from '../utils/output.js'

export async function startCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')

  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    const isFilled = content.trim().length > 100 && !content.includes('TODO: filled by')

    if (isFilled) {
      console.log('📋 Current project context:')
      blankLine()
      console.log(content)
    } else {
      console.log('📝 big_picture.md needs to be filled in')
      console.log(`   Path: ${bigPicturePath}`)
    }
  } else {
    console.log('📝 big_picture.md not found')
  }

  blankLine()
  console.log('Fill in big_picture.md with your project context:')
  console.log('  - What does this project do?')
  console.log('  - Who are the users?')
  console.log('  - Tech stack and key dependencies')
  console.log('  - Architecture decisions and patterns')
  console.log('  - Conventions and constraints')
}
