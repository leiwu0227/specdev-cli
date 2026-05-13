import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateSpecdevSystem, isValidSpecdevInstallation, updateSkillFiles, updateHookScript, backfillAdapters, migrateWorkflowManifest } from '../utils/update.js'
import { SKILL_FILES, ALL_ADAPTERS, COMMAND_SKILL_DIRS, adapterContent } from './init.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'
import { checkReviewerCLIs, printReviewerCheck } from '../utils/reviewers.js'

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
    '_main.md', '_index.md', 'workflow.yaml', '_guides/', '_templates/',
    'agents/',
    'skills/core/', 'skills/tools/ (official built-in only)',
    'skills/README.md', 'project_scaffolding/_README.md',
    'Platform adapters (if missing)',
  ]
  const preserved = [
    'project_notes/', 'assignments/', 'skills/tools/ (custom)',
    'project_scaffolding/ (except _README.md)',
    'Existing platform adapters',
  ]

  if (dryRun) {
    if (flags.json) {
      const pkg = await import('../../package.json', { with: { type: 'json' } })
      console.log(JSON.stringify({
        command: 'update',
        version: 1,
        status: 'ok',
        dry_run: true,
        cli_version: pkg.default.version,
        release_date: pkg.default.releaseDate || null,
        would_update: wouldUpdate,
        preserved,
      }, null, 2))
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

    // Migrate workflow.yaml in-place (v1 → v2). Idempotent for v2 manifests.
    const manifestMigration = migrateWorkflowManifest(
      join(templatePath, 'workflow.yaml'),
      join(specdevPath, 'workflow.yaml'),
      { force: !!flags.force }
    )
    if (manifestMigration.migrated) {
      const label = manifestMigration.from === null
        ? 'workflow.yaml (created from template)'
        : `workflow.yaml (migrated v${manifestMigration.from} → v2)`
      updatedPaths.push(label)
    }
    if (!flags.json) {
      for (const w of manifestMigration.warnings) {
        console.warn(`⚠️  ${w}`)
      }
    }

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
      try { await skillsSyncCommand({ ...flags, json: undefined }) } finally { console.log = origLog }
    } else {
      await skillsSyncCommand(flags)
    }

    if (flags.json) {
      console.log(JSON.stringify({
        command: 'update',
        version: 1,
        status: 'ok',
        cli_version: pkg.default.version,
        release_date: pkg.default.releaseDate || null,
        updated: updatedPaths,
        skill_updates: skillUpdates.map(u => ({ path: u.path, count: u.count })),
        hook_updated: hookUpdated > 0,
        adapters_created: createdAdapters,
        preserved: ['project_notes/', 'assignments/', 'skills/tools/', 'project_scaffolding/'],
      }, null, 2))
      return
    }

    const dateSuffix = pkg.default.releaseDate ? ` (${pkg.default.releaseDate})` : ''
    console.log(`✅ SpecDev updated to v${pkg.default.version}${dateSuffix}`)
    blankLine()
    printSection('📝 Updated:')
    updatedPaths.forEach(path => {
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
    printBullets([
      'project_notes/ (your project documentation)',
      'assignments/ (your active work)',
      'skills/tools/ (your custom tool skills)',
      'project_scaffolding/ (except _README.md)',
    ], '   • ')
    // Check reviewer CLIs
    blankLine()
    printSection('Reviewer CLIs:')
    const reviewerResults = await checkReviewerCLIs(specdevPath)
    if (reviewerResults.length > 0) {
      printReviewerCheck(reviewerResults)
    } else {
      console.log('   (no reviewer configs found)')
    }

    blankLine()
    console.log('💡 Your project-specific files remain untouched (except official built-in tool skills)')
    console.log('💡 For legacy .specdev layouts, run: specdev migrate')
    console.log('💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run')
    console.log('💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files')
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'update', version: 1, status: 'error', error: error.message }, null, 2))
    } else {
      console.error('❌ Failed to update SpecDev:', error.message)
    }
    process.exitCode = 1
  }
}
