import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fse from 'fs-extra'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Platform adapter configurations
function adapterContent(heading) {
  return `# ${heading}

Read \`.specdev/_main.md\` for the full SpecDev workflow and rules.

IMPORTANT: Before starting any subtask, announce "Using specdev: <what you're doing>".
If you stop announcing subtasks, the user will assume you've stopped following the workflow.
`
}

const ADAPTERS = {
  claude:  { path: 'CLAUDE.md',              heading: 'CLAUDE.md' },
  codex:   { path: 'AGENTS.md',              heading: 'AGENTS.md' },
  cursor:  { path: join('.cursor', 'rules'), heading: 'Cursor Rules' },
  generic: { path: 'AGENTS.md',              heading: 'AGENTS.md' },
}

export const SKILL_FILES = {
  'specdev-start': `---
name: specdev-start
description: Interactive Q&A to fill in your project's big_picture.md
---

Read \`.specdev/project_notes/big_picture.md\`.

**If it already has content** (not the default "TODO: filled by user" template):
- Present the current content to the user
- Ask: "This is your current big picture. Would you like to update it?"
- If yes, ask which sections to change. If no, you're done.

**If empty or still the template:**

1. Run \`bash .specdev/skills/core/brainstorming/scripts/get-project-context.sh .\` and review the output silently to orient yourself.

2. Ask the user the following questions **one at a time**, waiting for each answer before proceeding:
   - What does this project do? (1-2 sentence summary)
   - Who are the users or consumers of this project?
   - What's the tech stack? (languages, frameworks, key dependencies)
   - What are the key architectural decisions or patterns?
   - Any conventions or constraints the team follows?

3. After all questions are answered, compose a clean \`big_picture.md\` with the following sections and write it to \`.specdev/project_notes/big_picture.md\`:

\`\`\`markdown
# Project Big Picture

## Overview
<what the project does>

## Users / Consumers
<who uses it>

## Tech Stack
<languages, frameworks, key deps>

## Architecture
<key decisions and patterns>

## Conventions & Constraints
<team rules, style guides, constraints>
\`\`\`

4. Show the user the final content and ask them to confirm or request changes before writing.
`,
  'specdev-assignment': `---
name: specdev-assignment
description: Create a new assignment and start the brainstorm phase
---

Run \`specdev assignment <name>\` where <name> describes the feature.

Then read \`.specdev/skills/core/brainstorming/SKILL.md\` and follow it exactly.

Announce every subtask with "Using specdev: <action>".
`,
  'specdev-rewind': `---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read \`.specdev/_main.md\` completely
2. Check the latest assignment in \`.specdev/assignments/\` and determine current phase
3. Resume work following the workflow rules

Announce every subtask with "Using specdev: <action>".
`,
  'specdev-brainstorm': `---
name: specdev-brainstorm
description: Start the specdev brainstorm phase for a new feature or change
---

Read \`.specdev/skills/core/brainstorming/SKILL.md\` and follow it exactly.

Start by reading \`.specdev/_main.md\` for workflow context, then begin
the interactive brainstorm process with the user.
`,
  'specdev-continue': `---
name: specdev-continue
description: Resume specdev work from where you left off
---

1. Run \`specdev start\` to check project context
2. Check the latest assignment in \`.specdev/assignments/\`
3. Determine current phase from artifacts:
   - No brainstorm artifacts → run \`specdev assignment <name>\`
   - Has design, no plan → run \`specdev breakdown\`
   - Has plan, no implementation → run \`specdev implement\`
   - Has implementation → check if all tasks complete
4. Read the skill for your current phase and continue

Announce every subtask with "Using specdev: <action>".
`,
  'specdev-review': `---
name: specdev-review
description: Phase-aware manual review of the current assignment
---

Run \`specdev review\` to see the current assignment's phase and review context.

Follow the printed instructions to review the appropriate artifacts.
Discuss findings with the user before concluding.
`,
}

export async function initCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const force = flags.force || flags.f
  const dryRun = flags['dry-run']
  const platform = flags.platform || 'generic'

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

  // Validate platform
  if (!ADAPTERS[platform]) {
    console.error(`❌ Unknown platform: ${platform}`)
    console.log(`   Supported platforms: ${Object.keys(ADAPTERS).join(', ')}`)
    process.exit(1)
  }

  // Check if .specdev already exists
  if (existsSync(specdevPath) && !force) {
    console.error('❌ .specdev folder already exists in this directory')
    console.log('   Use --force to overwrite, or remove the existing folder first')
    process.exit(1)
  }

  if (dryRun) {
    console.log('🔍 Dry run mode - would copy:')
    console.log(`   From: ${templatePath}`)
    console.log(`   To: ${specdevPath}`)
    return
  }

  // Copy the template
  try {
    if (force) {
      await fse.remove(specdevPath)
    }
    await fse.copy(templatePath, specdevPath, {
      overwrite: force,
      errorOnExist: !force,
    })

    // Generate platform adapter file (never overwrite existing)
    const adapter = ADAPTERS[platform]
    const adapterPath = join(targetDir, adapter.path)

    if (!existsSync(adapterPath)) {
      // Ensure parent directory exists (needed for .cursor/rules)
      const adapterDir = dirname(adapterPath)
      if (!existsSync(adapterDir)) {
        mkdirSync(adapterDir, { recursive: true })
      }
      writeFileSync(adapterPath, adapterContent(adapter.heading), 'utf-8')
      console.log(`✅ Created ${adapter.path} for ${platform} platform`)
    } else {
      console.log(`ℹ️  ${adapter.path} already exists, skipping (preserving your customizations)`)
    }

    // Install skills for claude platform
    if (platform === 'claude') {
      const skillsDir = join(targetDir, '.claude', 'skills')
      for (const [skillName, content] of Object.entries(SKILL_FILES)) {
        const skillDir = join(skillsDir, skillName)
        mkdirSync(skillDir, { recursive: true })
        writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
      }
      console.log(`✅ Installed ${Object.keys(SKILL_FILES).length} skills to .claude/skills/`)

      // Install SessionStart hook
      const hookDir = join(targetDir, '.claude', 'hooks')
      mkdirSync(hookDir, { recursive: true })

      const hookScriptSrc = join(__dirname, '../../hooks/session-start.sh')
      const hookScriptDest = join(hookDir, 'specdev-session-start.sh')

      if (existsSync(hookScriptSrc)) {
        const hookContent = readFileSync(hookScriptSrc, 'utf-8')
        writeFileSync(hookScriptDest, hookContent, { mode: 0o755 })
        console.log('✅ Installed SessionStart hook to .claude/hooks/')
      }
    }

    console.log('✅ SpecDev initialized successfully!')
    console.log('')
    console.log('📖 Next steps:')
    if (platform === 'claude') {
      console.log('   1. Use /specdev-start to fill in your project context')
      console.log('   2. Use /specdev-brainstorm to start a new feature or change')
      console.log('   3. Use /specdev-continue to resume where you left off')
      console.log('')
      console.log('Installed slash commands:')
      console.log('   /specdev-start        Interactive project context setup')
      console.log('   /specdev-brainstorm   Start brainstorm for a new assignment')
      console.log('   /specdev-assignment   Create a new assignment')
      console.log('   /specdev-continue     Resume from current phase')
      console.log('   /specdev-rewind       Full workflow re-read')
      console.log('   /specdev-review       Phase-aware manual review')
    } else {
      console.log('   1. Fill in .specdev/project_notes/big_picture.md with your project context')
      console.log('   2. Ask your coding agent to read .specdev/_main.md')
      console.log('   3. Describe what you want to build — the agent will start brainstorming')
      console.log('')
      console.log('Useful commands:')
      console.log('   specdev assignment <name>    Create or resume an assignment')
      console.log('   specdev start                Check project context and status')
    }
  } catch (error) {
    console.error('❌ Failed to initialize SpecDev:', error.message)
    process.exit(1)
  }
}
