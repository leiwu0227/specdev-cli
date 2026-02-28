import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir, parseFrontmatter } from '../utils/skills.js'
import { readActiveTools, writeActiveTools } from '../utils/active-tools.js'
import { generateWrapperContent, writeWrappers, removeWrappers } from '../utils/wrappers.js'
import { blankLine } from '../utils/output.js'

export async function skillsSyncCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const toolsDir = join(specdevPath, 'skills', 'tools')

  const activeTools = await readActiveTools(specdevPath)
  const available = await scanSkillsDir(toolsDir, 'tool')
  const availableNames = new Set(available.map(s => s.name))

  let changed = false

  // 1. Remove stale entries (in active-tools but no longer in tools/)
  for (const name of Object.keys(activeTools.tools)) {
    if (!availableNames.has(name)) {
      const wrapperPaths = activeTools.tools[name].wrappers || []
      removeWrappers(targetDir, wrapperPaths)
      delete activeTools.tools[name]
      console.log(`  Removed stale: ${name}`)
      changed = true
    }
  }

  // 2. Regenerate missing wrappers for active tools
  for (const [name, entry] of Object.entries(activeTools.tools)) {
    const wrapperPaths = entry.wrappers || []
    const missing = wrapperPaths.filter(p => !fse.pathExistsSync(join(targetDir, p)))

    if (missing.length > 0) {
      // Re-read skill to regenerate
      const skillMdPath = join(toolsDir, name, 'SKILL.md')
      if (await fse.pathExists(skillMdPath)) {
        const content = await fse.readFile(skillMdPath, 'utf-8')
        const fm = parseFrontmatter(content)
        const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)
        const body = bodyMatch ? bodyMatch[1].trim() : ''
        const wrapperContent = generateWrapperContent({
          name: fm.name || name,
          description: fm.description || '',
          summary: '',
          body,
        })
        const agents = activeTools.agents || []
        const newPaths = writeWrappers(targetDir, name, wrapperContent, agents)
        entry.wrappers = newPaths
        console.log(`  Regenerated wrappers: ${name}`)
        changed = true
      }
    }
  }

  // 3. Warn about available but inactive tools
  const activeNames = new Set(Object.keys(activeTools.tools))
  const inactive = available.filter(s => !activeNames.has(s.name))
  if (inactive.length > 0) {
    blankLine()
    console.log('Available but not installed:')
    for (const s of inactive) {
      const desc = s.description ? ` — ${s.description}` : ''
      console.log(`  ${s.name}${desc}`)
    }
    console.log('\nRun: specdev skills install --skills=<name>')
  }

  if (changed) {
    await writeActiveTools(specdevPath, activeTools)
  }

  if (!changed && inactive.length === 0) {
    console.log('Sync complete — everything up to date')
  }
}
