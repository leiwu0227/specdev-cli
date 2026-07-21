import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  updateSpecdevSystem,
  isValidSpecdevInstallation,
  updateSkillFiles,
  updateHookScript,
  backfillAdapters,
} from '../utils/update.js'
import { SKILL_FILES, ALL_ADAPTERS, COMMAND_SKILL_DIRS, adapterContent } from './init.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'
import { installWorkspaceEngine } from '../utils/engine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function updateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const dryRun = flags['dry-run']

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

  // Check if .specdev exists
  const isValid = await isValidSpecdevInstallation(specdevPath)
  if (!isValid) {
    console.error('❌ No valid .specdev installation found in this directory')
    console.log('   Run "specdev init" first to initialize SpecDev')
    process.exitCode = 1
    return
  }

  const wouldUpdate = [
    '_main.md',
    '_index.md',
    'workflow.json',
    'workflows/',
    '_guides/',
    '_templates/',
    'guides/review.md',
    'guides/library/',
    'skills/core/',
    'skills/tools/ (official built-in only)',
    'skills/README.md',
    'Platform adapters (if missing)',
  ]
  const preserved = [
    'project_notes/',
    'assignments/',
    'missions/',
    'discussions/',
    'test-audits/',
    'knowledge/',
    'skills/tools/ (custom)',
    'agents.yaml',
    'guides/project/',
    'project_scaffolding/ (legacy custom files)',
    'Existing platform adapters',
  ]

  if (dryRun) {
    if (flags.json) {
      const pkg = await import('../../package.json', { with: { type: 'json' } })
      console.log(
        JSON.stringify(
          {
            command: 'update',
            version: 1,
            status: 'ok',
            dry_run: true,
            cli_version: pkg.default.version,
            release_date: pkg.default.releaseDate || null,
            would_update: wouldUpdate,
            preserved,
          },
          null,
          2
        )
      )
      return
    }
    printSection('🔍 Dry run mode - would update:')
    printBullets(wouldUpdate, '   - ')
    blankLine()
    printSection('📌 Preserved (not updated):')
    printBullets(preserved, '   - ')
    return
  }

  // Update system files
  try {
    if (!flags.json) {
      console.log('🔄 Updating SpecDev system files...')
      blankLine()
    }

    const updatedPaths = await updateSpecdevSystem(templatePath, specdevPath)
    const engine = installWorkspaceEngine(targetDir)

    const pkg = await import('../../package.json', { with: { type: 'json' } })

    // Update skill files if installed
    const skillUpdates = updateSkillFiles(targetDir, SKILL_FILES, COMMAND_SKILL_DIRS)

    // Update hook script if installed
    const hookSrcDir = join(__dirname, '../../hooks')
    const hookUpdated = updateHookScript(targetDir, hookSrcDir)

    // Backfill missing platform adapters
    const createdAdapters = backfillAdapters(targetDir, ALL_ADAPTERS, adapterContent)

    // Sync tool skill wrappers (suppress JSON from sync when we handle our own)
    const { skillsSyncCommand } = await import('./skills-sync.js')
    if (flags.json) {
      // Suppress sync output when update handles its own JSON
      const origLog = console.log
      console.log = () => {}
      try {
        await skillsSyncCommand({ ...flags, json: undefined })
      } finally {
        console.log = origLog
      }
    } else {
      await skillsSyncCommand(flags)
    }

    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            command: 'update',
            version: 1,
            status: 'ok',
            cli_version: pkg.default.version,
            release_date: pkg.default.releaseDate || null,
            updated: updatedPaths,
            skill_updates: skillUpdates.map((u) => ({ path: u.path, count: u.count })),
            hook_updated: hookUpdated > 0,
            adapters_created: createdAdapters,
            guided_workflows: engine.registered.length - 1,
            preserved: [
              'project_notes/',
              'assignments/',
              'missions/',
              'discussions/',
              'test-audits/',
              'knowledge/',
              'agents.yaml',
              'guides/project/',
              'skills/tools/',
              'project_scaffolding/ (legacy custom files)',
            ],
          },
          null,
          2
        )
      )
      return
    }

    const dateSuffix = pkg.default.releaseDate ? ` (${pkg.default.releaseDate})` : ''
    console.log(`✅ SpecDev updated to v${pkg.default.version}${dateSuffix}`)
    blankLine()
    printSection('📝 Updated:')
    updatedPaths.forEach((path) => {
      console.log(`   ✓ ${path}`)
    })

    for (const update of skillUpdates) {
      console.log(`   ✓ ${update.path}/ (${update.count} skill files)`)
    }

    if (hookUpdated > 0) {
      console.log('   ✓ .claude/hooks/specdev-session-start.sh')
    }

    if (createdAdapters.length > 0) {
      for (const path of createdAdapters) {
        console.log(`   + ${path} (created — was missing)`)
      }
    }

    blankLine()
    printSection('📌 Preserved:')
    printBullets(
      [
        'project_notes/ (your project documentation)',
        'assignments/ (your active work)',
        'skills/tools/ (your custom tool skills)',
        'missions/ and discussions/ (your durable work)',
        'test-audits/ and knowledge/ (your durable analysis and guidance)',
        'guides/project/ (your project guidance)',
        'project_scaffolding/ (legacy custom files, if present)',
      ],
      '   • '
    )
    blankLine()
    console.log(
      '💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml'
    )

    blankLine()
    console.log('💡 Your project-owned notes, work, profiles, and guides remain untouched')
    console.log('💡 For legacy .specdev layouts, run: specdev migrate')
    console.log(
      '💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run'
    )
    console.log(
      '💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files'
    )
  } catch (error) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          { command: 'update', version: 1, status: 'error', error: error.message },
          null,
          2
        )
      )
    } else {
      console.error('❌ Failed to update SpecDev:', error.message)
    }
    process.exitCode = 1
  }
}
