import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir } from '../utils/skills.js'

export async function skillsCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exit(1)
  }

  const skills = []

  skills.push(...await scanSkillsDir(join(skillsPath, 'core'), 'core'))
  skills.push(...await scanSkillsDir(join(skillsPath, 'tools'), 'tool'))

  skills.sort((a, b) => a.name.localeCompare(b.name))

  console.log(`\nAvailable skills (${skills.length}):\n`)
  const coreSkills = skills.filter(s => s.category === 'core')
  const toolSkills = skills.filter(s => s.category === 'tool')

  if (coreSkills.length > 0) {
    console.log('Core skills:')
    for (const skill of coreSkills) {
      const scripts = skill.hasScripts ? ' [scripts]' : ''
      const desc = skill.description ? ` — ${skill.description}` : ''
      console.log(`  ${skill.name}${scripts}${desc}`)
    }
    console.log()
  }

  if (toolSkills.length > 0) {
    console.log('Tool skills:')
    for (const skill of toolSkills) {
      const scripts = skill.hasScripts ? ' [scripts]' : ''
      const desc = skill.description ? ` — ${skill.description}` : ''
      console.log(`  ${skill.name}${scripts}${desc}`)
    }
    console.log()
  }
  console.log()
}
