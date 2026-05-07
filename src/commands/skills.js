import { join, relative, resolve } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir } from '../utils/skills.js'
import { readActiveTools } from '../utils/active-tools.js'

export async function skillsCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]

  if (subcommand === 'view') {
    return skillsViewCommand(positionalArgs.slice(1), flags)
  }
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
  const { skills, error } = await loadSkills(targetDir)
  if (error) {
    console.error(error)
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  // Load activation state for tool skills
  const activeTools = await readActiveTools(join(targetDir, '.specdev'))
  const activeNames = new Set(Object.keys(activeTools.tools))

  if (flags.json) {
    console.log(JSON.stringify({
      command: 'skills',
      version: 1,
      status: 'ok',
      skills: skills.map((skill) => toSkillJson(skill, activeNames)),
    }, null, 2))
    return
  }

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

async function loadSkills(targetDir) {
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    return { error: 'No .specdev/skills directory found.' }
  }

  const skills = []
  skills.push(...await scanSkillsDir(join(skillsPath, 'core'), 'core'))
  skills.push(...await scanSkillsDir(join(skillsPath, 'tools'), 'tool'))
  skills.sort((a, b) => a.name.localeCompare(b.name))

  return { skills, skillsPath }
}

async function skillsViewCommand(args, flags) {
  const skillName = args[0]
  const relativePath = args[1] || 'SKILL.md'
  if (!skillName) {
    console.error('Usage: specdev skills view <name> [relative-path]')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const { skills, error } = await loadSkills(targetDir)
  if (error) {
    console.error(error)
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  const skill = skills.find((item) => item.name === skillName)
  if (!skill) {
    console.error(`Unknown skill: ${skillName}`)
    process.exitCode = 1
    return
  }

  const baseDir = skill.path.endsWith('.md') ? resolve(skill.path, '..') : resolve(skill.path)
  const targetPath = relativePath === 'SKILL.md' ? skill.skillMdPath : join(baseDir, relativePath)
  const resolvedTarget = resolve(targetPath)
  const rel = relative(baseDir, resolvedTarget)
  if (rel.startsWith('..') || rel === '..' || rel.startsWith('/') || rel.startsWith('\\')) {
    console.error('Cannot read outside skill directory')
    process.exitCode = 1
    return
  }

  if (!(await fse.pathExists(resolvedTarget))) {
    console.error(`Skill file not found: ${relativePath}`)
    process.exitCode = 1
    return
  }

  console.log(await fse.readFile(resolvedTarget, 'utf-8'))
}

function toSkillJson(skill, activeNames) {
  const item = {
    name: skill.name,
    category: skill.category,
    description: skill.description,
    path: skill.path,
    skill_md_path: skill.skillMdPath,
    has_scripts: skill.hasScripts,
  }
  if (skill.category === 'tool') {
    item.active = activeNames.has(skill.name)
  }
  return item
}
