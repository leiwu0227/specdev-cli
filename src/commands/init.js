import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fse from 'fs-extra'
import { blankLine, printLines, printSection } from '../utils/output.js'
import { skillsInstallCommand } from './skills-install.js'
import { scanSkillsDir } from '../utils/skills.js'
import { checkReviewerCLIs, printReviewerCheck } from '../utils/reviewers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Platform adapter configurations
export function adapterContent(heading) {
  return `# ${heading}

Read \`.specdev/_main.md\` for the full SpecDev workflow and rules.

If this repository develops SpecDev itself, treat \`.specdev/\` as the installed workflow/runtime state, not as product source. When changing SpecDev behavior, edit source files such as \`src/\`, \`templates/.specdev/\`, tests, and docs. Do not edit or commit \`.specdev\` workflow files unless the user explicitly runs or asks for \`specdev update\`.

IMPORTANT: Before starting any subtask, announce "Specdev: <what you're doing>".
If you stop announcing subtasks, the user will assume you've stopped following the workflow.
`
}

export const ADAPTERS = {
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

Run \`specdev assignment "<user's description>"\` to reserve an assignment ID.

Read the output to get the reserved ID, then:
1. Pick a type (feature | bugfix | refactor | familiarization) and a short hyphenated slug based on the description
2. Create the assignment folder: \`.specdev/assignments/<ID>_<type>_<slug>/\`
3. Create brainstorm/ and context/ subdirectories inside it
4. Read \`.specdev/_guides/workflow.md\` to determine which brainstorm skill to use
5. Follow the chosen skill exactly

Announce every subtask with "Specdev: <action>".
`,
  'specdev-rewind': `---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read \`.specdev/_main.md\` completely
2. Check the latest assignment in \`.specdev/assignments/\` and determine current phase
3. Resume work following the workflow rules

Announce every subtask with "Specdev: <action>".
`,
  'specdev-continue': `---
name: specdev-continue
description: Resume specdev work from where you left off
---

Run \`specdev continue\`.

Use the detected state and next action from that output.
If blockers are reported, resolve them first (for example \`specdev migrate\`).

Announce every subtask with "Specdev: <action>".
`,
  'specdev-review': `---
name: specdev-review
description: Phase-aware manual review of the current assignment
---

Run \`specdev review brainstorm\` or \`specdev review implementation\` to see the review context for the given phase.

Follow the printed instructions to review the appropriate artifacts.
Discuss findings with the user before concluding.
`,
  'specdev-layout-migration': `---
name: specdev-layout-migration
description: Guide an agent through a safe, user-approved .specdev layout migration
---

Read \`.specdev/_guides/migration_guide.md\`.

Follow the guide as an interactive migration workflow:

1. Inspect the existing \`.specdev/\` tree without moving files.
2. Classify artifacts against the modern structure.
3. Write \`.specdev/migration/layout-plan.md\` with proposed moves, files to leave in place, and questions for the user.
4. Ask the user to approve the plan before editing.
5. Apply only approved moves, preserving content and avoiding overwrites.
6. Verify with \`specdev status --json\` and summarize what changed.

If the user only needs the old deterministic assignment-file migration, discuss \`specdev migrate legacy-assignments --dry-run\` first.

Announce every subtask with "Specdev: <action>".
`,
  'specdev-check-review': `---
name: specdev-check-review
description: Read and address review feedback from a separate review session
---

Run \`specdev check-review <phase>\` to read review findings (phase is brainstorm or implementation).

Address the findings in the phase artifacts.
Write a summary of changes to \`review/{phase}-changelog.md\` under \`## Round N\`.
Then say "auto review" or run "specdev review" in a separate session.

Announce every subtask with "Specdev: <action>".
`,
  'specdev-discussion': `---
name: specdev-discussion
description: Start a parallel brainstorming discussion
---

Run \`specdev discussion "<description>"\` to reserve a discussion ID.

Read the output to get the reserved ID (e.g. D00001) and folder path, then:
1. Follow \`.specdev/skills/core/brainstorming/SKILL.md\` for Phases 1-3 (Understand, Explore, Design), writing artifacts to the discussion's brainstorm/ folder
2. After writing brainstorm/proposal.md and brainstorm/design.md, add a row to \`.specdev/project_notes/discussion_progress.md\`
3. Tell the user: \`specdev reviewloop discussion --discussion=<ID>\` for review (optional)

**Discussions are NOT assignments.** Do NOT use \`specdev reviewloop brainstorm\`, \`specdev approve\`, or \`specdev continue\` — those require an assignment.

Announce every subtask with "Specdev: <action>".
`,
  'specdev-reviewloop': `---
name: specdev-reviewloop
description: Automated external review loop — spawns an external reviewer CLI, reads verdict, auto-approves on pass
---

## For assignments

Run \`specdev reviewloop <phase>\` where phase is \`brainstorm\` or \`implementation\`.

Without \`--reviewer\`: lists available reviewers. If the user has already chosen automated review mode, ask reviewer type as a second multiple-choice question. Use one choice per reviewer config; do not ask for free-form reviewer text.
With \`--reviewer=<name>\`: spawns the reviewer and processes results automatically.
With \`--autocontinue\`: after approval, continue to the next workflow phase without another user prompt.

Flow:
1. \`specdev reviewloop <phase>\` — lists reviewers
2. Ask the user whether to run review-only or review-then-autocontinue
3. Ask reviewer type as a second multiple-choice question
4. \`specdev reviewloop <phase> --reviewer=<name>\` — runs review
5. On pass → auto-approves the phase. **The gate is satisfied — proceed immediately to the next phase.** Do NOT ask the user to run \`specdev approve\` separately.
6. On fail → run \`specdev check-review <phase>\` to address findings, then re-run reviewloop

## For discussions

Run \`specdev reviewloop discussion --discussion=<ID>\` where ID is the discussion ID (e.g. D00001).

Flow:
1. \`specdev reviewloop discussion --discussion=<ID>\` — lists reviewers
2. Ask reviewer type as a multiple-choice question with one choice per reviewer config
3. \`specdev reviewloop discussion --discussion=<ID> --reviewer=<name>\` — runs review
4. On pass → discussion review complete. No phase approval needed.
5. On fail → address findings, then re-run

**Do NOT use \`specdev reviewloop brainstorm\` for discussions — that requires an assignment.**

This is a Node.js CLI command — run it directly, never via pip/python.
`,
}

// The unique adapters to create on every init
export const ALL_ADAPTERS = [
  ADAPTERS.claude,
  ADAPTERS.codex,   // AGENTS.md — same for codex and generic
  ADAPTERS.cursor,
]

export const COMMAND_SKILL_DIRS = [
  join('.claude', 'skills'),
  join('.codex', 'skills'),
]

export async function initCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const force = flags.force || flags.f
  const dryRun = flags['dry-run']

  if (flags.platform && !flags.json) {
    console.log('ℹ️  --platform is deprecated and ignored; all adapters are now created automatically')
  }

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

  // Check if .specdev already exists
  if (existsSync(specdevPath) && !force) {
    if (flags.json) {
      console.log(JSON.stringify({
        command: 'init',
        version: 1,
        status: 'error',
        error: '.specdev folder already exists in this directory',
        path: specdevPath,
      }, null, 2))
      process.exitCode = 1
      return
    }
    console.error('❌ .specdev folder already exists in this directory')
    console.log('   Use --force to overwrite, or remove the existing folder first')
    process.exitCode = 1
    return
  }

  if (dryRun) {
    if (flags.json) {
      console.log(JSON.stringify({
        command: 'init',
        version: 1,
        status: 'ok',
        dry_run: true,
        from: templatePath,
        to: specdevPath,
      }, null, 2))
      return
    }
    console.log('🔍 Dry run mode - would copy:')
    console.log(`   From: ${templatePath}`)
    console.log(`   To: ${specdevPath}`)
    return
  }

  // Copy the template
  const origLog = flags.json ? console.log : null
  if (flags.json) console.log = () => {}
  try {
    if (force) {
      await fse.remove(specdevPath)
    }
    await fse.copy(templatePath, specdevPath, {
      overwrite: force,
      errorOnExist: !force,
    })

    // Generate all platform adapter files (never overwrite existing)
    for (const adapter of ALL_ADAPTERS) {
      const adapterPath = join(targetDir, adapter.path)

      if (!existsSync(adapterPath)) {
        // Ensure parent directory exists (needed for .cursor/rules)
        const adapterDir = dirname(adapterPath)
        if (!existsSync(adapterDir)) {
          mkdirSync(adapterDir, { recursive: true })
        }
        writeFileSync(adapterPath, adapterContent(adapter.heading), 'utf-8')
        console.log(`✅ Created ${adapter.path}`)
      } else {
        console.log(`ℹ️  ${adapter.path} already exists, skipping (preserving your customizations)`)
      }
    }

    // Install command skills for the supported first-class agents.
    for (const skillDirRoot of COMMAND_SKILL_DIRS) {
      const skillsDir = join(targetDir, skillDirRoot)
      for (const [skillName, content] of Object.entries(SKILL_FILES)) {
        const skillDir = join(skillsDir, skillName)
        mkdirSync(skillDir, { recursive: true })
        writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
      }
      console.log(`✅ Installed ${Object.keys(SKILL_FILES).length} skills to ${skillDirRoot}/`)
    }

    // Install Claude Code SessionStart hook
    const hookDir = join(targetDir, '.claude', 'hooks')
    mkdirSync(hookDir, { recursive: true })

    const hookScriptSrc = join(__dirname, '../../hooks/session-start.sh')
    const hookScriptDest = join(hookDir, 'specdev-session-start.sh')

    if (existsSync(hookScriptSrc)) {
      const hookContent = readFileSync(hookScriptSrc, 'utf-8')
      writeFileSync(hookScriptDest, hookContent, { mode: 0o755 })
      console.log('✅ Installed SessionStart hook to .claude/hooks/')

      // Register hook in .claude/settings.json
      const settingsPath = join(targetDir, '.claude', 'settings.json')
      let settings = {}
      let settingsParseFailed = false
      if (existsSync(settingsPath)) {
        try {
          settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
        } catch {
          settingsParseFailed = true
          console.warn('⚠️  .claude/settings.json is invalid JSON, skipping hook registration to avoid overwriting it')
        }
      }

      if (!settingsParseFailed) {
        if (!settings.hooks) settings.hooks = {}
        if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = []

        const specdevHookCommand = '.claude/hooks/specdev-session-start.sh'
        const alreadyRegistered = settings.hooks.SessionStart.some(
          (entry) => entry.hooks && entry.hooks.some((h) => h.command === specdevHookCommand)
        )

        if (!alreadyRegistered) {
          settings.hooks.SessionStart.push({
            matcher: 'startup|resume|clear|compact',
            hooks: [{ type: 'command', command: specdevHookCommand }],
          })
          writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
          console.log('✅ Registered SessionStart hook in .claude/settings.json')
        }
      }
    }

    // Auto-install tool skills if any are available
    const toolsDir = join(specdevPath, 'skills', 'tools')
    if (await fse.pathExists(toolsDir)) {
      const available = await scanSkillsDir(toolsDir, 'tool')
      if (available.length > 0) {
        const skillNames = available.map(s => s.name).join(',')
        blankLine()
        console.log('Installing tool skills...')
        await skillsInstallCommand([], { target: targetDir, skills: skillNames })
      }
    }

    if (origLog) {
      console.log = origLog
      console.log(JSON.stringify({
        command: 'init',
        version: 1,
        status: 'ok',
        path: specdevPath,
      }, null, 2))
      return
    }

    console.log('✅ SpecDev initialized successfully!')
    blankLine()
    printSection('📖 Next steps:')
    printLines([
      '   1. Use specdev-start (or run specdev start) to fill in your project context',
      '   2. Use specdev-assignment (or run specdev assignment) to start a change',
      '   3. Use specdev-continue (or run specdev continue) to resume where you left off',
    ])
    blankLine()
    printSection('Platform adapters created:')
    printLines([
      '   CLAUDE.md        Claude Code',
      '   AGENTS.md        Codex / generic agents',
      '   .cursor/rules    Cursor',
    ])
    blankLine()
    printSection('Agent command skills:')
    printLines([
      '   .claude/skills/       Claude Code',
      '   .codex/skills/        Codex',
      '   specdev-start         Interactive project context setup',
      '   specdev-assignment    Reserve ID and start brainstorm',
      '   specdev-continue      Resume from current phase',
      '   specdev-review        Phase-aware manual review',
      '   specdev-check-review  Read and address review feedback',
      '   specdev-reviewloop    Automated external review loop',
      '   specdev-rewind        Full workflow re-read',
    ])

    // Check reviewer CLIs
    blankLine()
    printSection('Reviewer CLIs:')
    const reviewerResults = await checkReviewerCLIs(specdevPath)
    if (reviewerResults.length > 0) {
      printReviewerCheck(reviewerResults)
    } else {
      console.log('   (no reviewer configs found)')
    }
  } catch (error) {
    if (origLog) console.log = origLog
    if (flags.json) {
      console.log(JSON.stringify({
        command: 'init',
        version: 1,
        status: 'error',
        error: error.message,
      }, null, 2))
      process.exitCode = 1
      return
    }
    console.error('❌ Failed to initialize SpecDev:', error.message)
    process.exitCode = 1
  }
}
