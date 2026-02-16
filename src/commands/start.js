import { join } from 'path'
import fse from 'fs-extra'

export async function startCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')

  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    const isFilled = content.trim().length > 100 && !content.includes('TODO: filled by')

    if (isFilled) {
      console.log('📋 Current project context:')
      console.log('')
      console.log(content)
    } else {
      console.log('📝 big_picture.md needs to be filled in')
      console.log(`   Path: ${bigPicturePath}`)
    }
  } else {
    console.log('📝 big_picture.md not found')
  }

  console.log('')
  console.log('Fill in big_picture.md with your project context:')
  console.log('  - What does this project do?')
  console.log('  - Who are the users?')
  console.log('  - Tech stack and key dependencies')
  console.log('  - Architecture decisions and patterns')
  console.log('  - Conventions and constraints')
}
