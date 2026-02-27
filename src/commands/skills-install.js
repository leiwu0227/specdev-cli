import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir, parseFrontmatter } from '../utils/skills.js'
import { readActiveTools, writeActiveTools } from '../utils/active-tools.js'
import { detectCodingAgents, AGENT_CONFIGS } from '../utils/agents.js'
import { generateWrapperContent, writeWrappers } from '../utils/wrappers.js'
import { blankLine } from '../utils/output.js'

export async function skillsInstallCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const toolsDir = join(specdevPath, 'skills', 'tools')

  if (!(await fse.pathExists(toolsDir))) {
    console.error('No .specdev/skills/tools/ directory found.')
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  // Scan available tool skills
  const available = await scanSkillsDir(toolsDir, 'tool')
  if (available.length === 0) {
    console.log('No tool skills found in .specdev/skills/tools/')
    return
  }

  // Determine which skills and agents to install
  let selectedSkills, selectedAgents

  if (flags.skills) {
    // Non-interactive mode
    selectedSkills = flags.skills.split(',').map(s => s.trim())
    const unknowns = selectedSkills.filter(s => !available.some(a => a.name === s))
    if (unknowns.length > 0) {
      console.error(`Unknown tool skills: ${unknowns.join(', ')}`)
      console.error(`Available: ${available.map(a => a.name).join(', ')}`)
      process.exitCode = 1
      return
    }
  } else {
    // Interactive mode: show available skills
    console.log('\nAvailable tool skills:')
    available.forEach((s, i) => {
      const desc = s.description ? ` — ${s.description}` : ''
      console.log(`  [${i + 1}] ${s.name}${desc}`)
    })
    blankLine()
    console.log('Use --skills=name1,name2 to select skills non-interactively')
    console.log('Example: specdev skills install --skills=fireperp')
    return
  }

  if (flags.agents) {
    selectedAgents = flags.agents.split(',').map(s => s.trim())
    const validAgents = Object.keys(AGENT_CONFIGS)
    const unknownAgents = selectedAgents.filter(a => !validAgents.includes(a))
    if (unknownAgents.length > 0) {
      console.error(`Unknown agents: ${unknownAgents.join(', ')}`)
      console.error(`Valid agents: ${validAgents.join(', ')}`)
      process.exitCode = 1
      return
    }
  } else {
    selectedAgents = detectCodingAgents(targetDir)
    if (selectedAgents.length === 0) {
      console.error('No coding agents detected. Create .claude/, .codex/, or .opencode/ first.')
      console.error('Or specify agents with --agents=claude-code,codex')
      process.exitCode = 1
      return
    }
  }

  const activeTools = await readActiveTools(specdevPath)
  const today = new Date().toISOString().slice(0, 10)

  for (const skillName of selectedSkills) {
    // Read the skill's SKILL.md for frontmatter
    const skillMdPath = join(toolsDir, skillName, 'SKILL.md')
    const skillContent = await fse.readFile(skillMdPath, 'utf-8')
    const frontmatter = parseFrontmatter(skillContent)

    // Generate wrapper
    const wrapperContent = generateWrapperContent({
      name: frontmatter.name || skillName,
      description: frontmatter.description || '',
      summary: '',
    })

    // Write wrappers to each agent
    const wrapperPaths = writeWrappers(targetDir, skillName, wrapperContent, selectedAgents)

    // Extract triggers from frontmatter if present
    const triggers = frontmatter.triggers || null

    // Record in active-tools.json
    activeTools.tools[skillName] = {
      installed: today,
      validation: 'none',
      lastValidated: null,
      wrappers: wrapperPaths,
      ...(triggers ? { triggers } : {}),
    }

    console.log(`Installed ${skillName}`)
    for (const p of wrapperPaths) {
      console.log(`   -> ${p}`)
    }
  }

  // Record agents
  const agentSet = new Set([...(activeTools.agents || []), ...selectedAgents])
  activeTools.agents = [...agentSet]

  await writeActiveTools(specdevPath, activeTools)
  blankLine()
  console.log(`Active tools updated (${Object.keys(activeTools.tools).length} tools, ${activeTools.agents.length} agents)`)
}
