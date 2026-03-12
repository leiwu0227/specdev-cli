import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { getNextDiscussionId } from '../utils/discussion.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { blankLine } from '../utils/output.js'

export async function discussCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.list) {
    const discussionsDir = join(specdevPath, 'discussions')
    if (!(await fse.pathExists(discussionsDir))) {
      console.log('No discussions found.')
      return
    }
    const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort()
    if (dirs.length === 0) {
      console.log('No discussions found.')
      return
    }
    console.log('Discussions:')
    for (const d of dirs) {
      console.log(`   - ${d}`)
    }
    return
  }

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled) {
    console.error('❌ big_picture.md not found or not filled in')
    process.exitCode = 1
    return
  }

  const description = positionalArgs.join(' ').trim()
  if (!description) {
    console.error('❌ No description provided')
    console.log('   Usage: specdev discuss "explore auth approaches"')
    console.log('   Usage: specdev discuss --list')
    process.exitCode = 1
    return
  }

  const nextId = await getNextDiscussionId(specdevPath)
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const folderName = `${nextId}_${slug}`
  const discussionPath = join(specdevPath, 'discussions', folderName)

  await fse.ensureDir(join(discussionPath, 'brainstorm'))

  const json = Boolean(flags.json)
  if (json) {
    console.log(JSON.stringify({
      version: 1,
      status: 'ok',
      id: nextId,
      name: folderName,
      path: discussionPath,
      description,
    }))
    return
  }

  console.log(`Discussion: ${nextId}`)
  console.log(`Description: ${description}`)
  blankLine()
  console.log(`Created: .specdev/discussions/${folderName}/`)
  blankLine()
  console.log('Start brainstorming:')
  console.log('   Read .specdev/skills/core/brainstorming/SKILL.md and follow it.')
  console.log(`   Write artifacts to: .specdev/discussions/${folderName}/brainstorm/`)
}
