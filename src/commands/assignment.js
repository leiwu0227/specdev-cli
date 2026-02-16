import { join } from 'path'
import fse from 'fs-extra'

export async function assignmentCommand(args = [], flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const specdevPath = join(targetDir, '.specdev')

  if (!(await fse.pathExists(specdevPath))) {
    console.error('❌ No .specdev directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  // Check big_picture.md is filled
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (await fse.pathExists(bigPicturePath)) {
    const content = await fse.readFile(bigPicturePath, 'utf-8')
    if (content.trim().length < 100 || content.includes('TODO: filled by')) {
      console.error('❌ big_picture.md is not filled in')
      console.log('   Run "specdev start" first to set up your project context')
      process.exit(1)
    }
  } else {
    console.error('❌ big_picture.md not found')
    process.exit(1)
  }

  // Determine next assignment ID
  const assignmentsDir = join(specdevPath, 'assignments')
  await fse.ensureDir(assignmentsDir)

  const existing = await fse.readdir(assignmentsDir)
  const ids = existing
    .map(name => parseInt(name.match(/^(\d+)/)?.[1], 10))
    .filter(n => !isNaN(n))
  const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const paddedId = String(nextId).padStart(5, '0')

  // Build assignment name
  const label = args[0] || 'unnamed'
  const dirName = `${paddedId}_feature_${label}`
  const assignmentPath = join(assignmentsDir, dirName)

  await fse.ensureDir(join(assignmentPath, 'brainstorm'))
  await fse.ensureDir(join(assignmentPath, 'context'))

  console.log(`✅ Assignment created: ${dirName}`)
  console.log(`   Path: ${assignmentPath}`)
  console.log('')
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  console.log(`   Write outputs to: ${dirName}/brainstorm/`)
}
