import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateSpecdevSystem, isValidSpecdevInstallation, updateSkillFiles, updateHookScript, backfillAdapters } from '../utils/update.js'
import { SKILL_FILES, ALL_ADAPTERS, adapterContent } from './init.js'
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

  if (dryRun) {
    printSection('🔍 Dry run mode - would update:')
    printBullets([
      '_main.md',
      '_index.md',
      '_guides/ (workflow guide and reference guides)',
      '_templates/ (scaffolding templates and examples)',
      'skills/core/ (all core workflow skills, fully overwritten)',
      'skills/tools/ (official built-in tool skills only)',
      'skills/README.md',
      'project_scaffolding/_README.md',
      'Platform adapters (CLAUDE.md, AGENTS.md, .cursor/rules) — only if missing',
    ], '   - ')
    blankLine()
    printSection('📌 Preserved (not updated):')
    printBullets([
      'project_notes/ (your project documentation)',
      'assignments/ (your active work)',
      'skills/tools/ (your custom tool skills)',
      'project_scaffolding/ (except _README.md)',
      'Existing platform adapters (never overwritten)',
    ], '   - ')
    return
  }

  // Update system files
  try {
    console.log('🔄 Updating SpecDev system files...')
    blankLine()

    const updatedPaths = await updateSpecdevSystem(templatePath, specdevPath)

    console.log('✅ SpecDev system files updated successfully!')
    blankLine()
    printSection('📝 Updated:')
    updatedPaths.forEach(path => {
      console.log(`   ✓ ${path}`)
    })

    // Update skill files if installed
    const skillCount = updateSkillFiles(targetDir, SKILL_FILES)
    if (skillCount > 0) {
      console.log(`   ✓ .claude/skills/ (${skillCount} skill files)`)
    }

    // Update hook script if installed
    const hookSrcDir = join(__dirname, '../../hooks')
    const hookUpdated = updateHookScript(targetDir, hookSrcDir)
    if (hookUpdated > 0) {
      console.log('   ✓ .claude/hooks/specdev-session-start.sh')
    }

    // Backfill missing platform adapters
    const createdAdapters = backfillAdapters(targetDir, ALL_ADAPTERS, adapterContent)
    if (createdAdapters.length > 0) {
      for (const path of createdAdapters) {
        console.log(`   + ${path} (created — was missing)`)
      }
    }

    // Sync tool skill wrappers
    const { skillsSyncCommand } = await import('./skills-sync.js')
    await skillsSyncCommand(flags)

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
    console.log('💡 If this project has legacy assignments, run: specdev migrate')
  } catch (error) {
    console.error('❌ Failed to update SpecDev:', error.message)
    process.exitCode = 1
  }
}
