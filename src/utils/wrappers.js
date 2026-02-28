import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { AGENT_CONFIGS } from './agents.js'

export function generateWrapperContent({ name, description, summary, body }) {
  const fullDesc = summary ? `${description}. ${summary}` : description

  // If full body is provided, embed the skill content directly
  if (body) {
    return `---
name: ${name}
description: ${fullDesc}
---

${body}
`
  }

  // Fallback: pointer to source (for backward compatibility)
  return `---
name: ${name}
description: ${fullDesc}
---

# ${name}

${description}

**Source of truth:** \`.specdev/skills/tools/${name}/SKILL.md\`
Read the source skill file and follow its instructions.
`
}

export function writeWrappers(targetDir, name, content, agents) {
  const paths = []
  const written = new Set()

  for (const agentName of agents) {
    const config = AGENT_CONFIGS[agentName]
    if (!config) continue

    const relPath = join(config.wrapperDir, config.wrapperFile(name))
    if (written.has(relPath)) continue
    written.add(relPath)

    const absPath = join(targetDir, relPath)
    const absDir = dirname(absPath)
    if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true })
    writeFileSync(absPath, content, 'utf-8')
    paths.push(relPath)
  }

  return paths
}

export function removeWrappers(targetDir, wrapperPaths) {
  for (const relPath of wrapperPaths) {
    const absPath = join(targetDir, relPath)
    if (existsSync(absPath)) {
      rmSync(absPath, { force: true })
      const parentDir = dirname(absPath)
      try {
        if (readdirSync(parentDir).length === 0) rmSync(parentDir, { recursive: true })
      } catch { /* ignore */ }
    }
  }
}
