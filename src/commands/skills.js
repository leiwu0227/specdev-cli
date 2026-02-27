import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir } from '../utils/skills.js'
import { readActiveTools } from '../utils/active-tools.js'

export async function skillsCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]

  if (subcommand === 'install') {
    const { skillsInstallCommand } = await import('./skills-install.js')
    return skillsInstallCommand(positionalArgs.slice(1), flags)
  }
  if (subcommand === 'remove') {
    const { skillsRemoveCommand } = await import('./skills-remove.js')
    return skillsRemoveCommand(positionalArgs.slice(1), flags)
  }
  if (subcommand === 'sync') {
    const { skillsSyncCommand } = await import('./skills-sync.js')
    return skillsSyncCommand(flags)
  }

  // Default: list skills
  return skillsListCommand(flags)
}

async function skillsListCommand(flags) {
  const targetDir = resolveTargetDir(flags)
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  const skills = []
  skills.push(...await scanSkillsDir(join(skillsPath, 'core'), 'core'))
  skills.push(...await scanSkillsDir(join(skillsPath, 'tools'), 'tool'))
  skills.sort((a, b) => a.name.localeCompare(b.name))

  // Load activation state for tool skills
  const activeTools = await readActiveTools(join(targetDir, '.specdev'))
  const activeNames = new Set(Object.keys(activeTools.tools))

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
      const status = activeNames.has(skill.name) ? ' [active]' : ' [available]'
      console.log(`  ${skill.name}${status}${scripts}${desc}`)
    }
    console.log()
  }
  console.log()
}
