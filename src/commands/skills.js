import { join } from 'path'
import fse from 'fs-extra'

export async function skillsCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exit(1)
  }

  const entries = await fse.readdir(skillsPath, { withFileTypes: true })
  const skills = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'README.md' || entry.name === 'skills_invoked_template.md') continue

    if (entry.isDirectory()) {
      // Folder-based skill: look for SKILL.md
      const skillMd = join(skillsPath, entry.name, 'SKILL.md')
      if (await fse.pathExists(skillMd)) {
        const content = await fse.readFile(skillMd, 'utf-8')
        const desc = parseFrontmatter(content).description || ''
        const hasScripts = await fse.pathExists(join(skillsPath, entry.name, 'scripts'))
        skills.push({ name: entry.name, type: 'folder', description: desc, hasScripts })
      }
    } else if (entry.name.endsWith('.md')) {
      // Flat .md skill (legacy)
      skills.push({ name: entry.name.replace('.md', ''), type: 'flat', description: '', hasScripts: false })
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))

  console.log(`\nAvailable skills (${skills.length}):\n`)
  for (const skill of skills) {
    const scripts = skill.hasScripts ? ' [scripts]' : ''
    const desc = skill.description ? ` — ${skill.description}` : ''
    console.log(`  ${skill.name}${scripts}${desc}`)
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
