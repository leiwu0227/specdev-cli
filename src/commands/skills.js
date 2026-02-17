import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'

export async function skillsCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exit(1)
  }

  const skills = []

  // Scan a directory for skills (folder-based and flat .md)
  async function scanDir(dir, category) {
    if (!(await fse.pathExists(dir))) return
    const entries = await fse.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'README.md' || entry.name === 'skills_invoked_template.md') continue

      if (entry.isDirectory()) {
        const skillMd = join(dir, entry.name, 'SKILL.md')
        if (await fse.pathExists(skillMd)) {
          const content = await fse.readFile(skillMd, 'utf-8')
          const desc = parseFrontmatter(content).description || ''
          const hasScripts = await fse.pathExists(join(dir, entry.name, 'scripts'))
          skills.push({ name: entry.name, type: 'folder', category, description: desc, hasScripts })
        }
      } else if (entry.name.endsWith('.md')) {
        skills.push({ name: entry.name.replace('.md', ''), type: 'flat', category, description: '', hasScripts: false })
      }
    }
  }

  await scanDir(join(skillsPath, 'core'), 'core')
  await scanDir(join(skillsPath, 'tools'), 'tool')

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

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) result[key.trim()] = rest.join(':').trim()
  }
  return result
}
