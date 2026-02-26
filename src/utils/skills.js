import { join } from 'path'
import fse from 'fs-extra'

export function parseFrontmatter(content) {
  // Minimal frontmatter parser for simple "key: value" metadata used by SKILL.md.
  // Ignores comments/blank lines and supports both LF/CRLF.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = line.split(':')
    if (key && rest.length) result[key.trim()] = rest.join(':').trim()
  }
  return result
}

export async function scanSkillsDir(dir, category) {
  const skills = []
  if (!(await fse.pathExists(dir))) return skills
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
        skills.push({ name: entry.name, description: desc, hasScripts, category })
      }
    } else if (entry.name.endsWith('.md')) {
      skills.push({ name: entry.name.replace('.md', ''), description: '', hasScripts: false, category })
    }
  }
  return skills
}
