import { join } from 'path'
import fse from 'fs-extra'

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result = {}
  let currentParent = null

  let currentKey = null  // tracks the last key at any level for list appending

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    // YAML list item under a nested key: "    - value"
    const nestedListItem = line.match(/^    -\s+(.+)$/)
    if (nestedListItem && currentParent && currentKey) {
      const val = parseYamlValue(nestedListItem[1])
      const target = result[currentParent][currentKey]
      if (Array.isArray(target)) {
        target.push(val)
      } else {
        result[currentParent][currentKey] = [val]
      }
      continue
    }

    // YAML list item under a top-level key: "  - value"
    const topListItem = line.match(/^  -\s+(.+)$/)
    if (topListItem && !currentParent && currentKey) {
      const val = parseYamlValue(topListItem[1])
      const target = result[currentKey]
      if (Array.isArray(target)) {
        target.push(val)
      } else {
        result[currentKey] = [val]
      }
      continue
    }

    const indented = line.match(/^  (\w[\w-]*):\s*(.*)$/)
    if (indented && currentParent) {
      const [, key, rawVal] = indented
      if (rawVal === '' || rawVal === undefined) {
        result[currentParent][key] = []
        currentKey = key
      } else {
        result[currentParent][key] = parseYamlValue(rawVal)
        currentKey = key
      }
      continue
    }

    const topLevel = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (topLevel) {
      const [, key, rawVal] = topLevel
      if (rawVal === '' || rawVal === undefined) {
        result[key] = {}
        currentParent = key
        currentKey = null
      } else {
        result[key] = parseYamlValue(rawVal)
        currentParent = null
        currentKey = key
      }
    }
  }
  return result
}

function parseYamlValue(raw) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
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
