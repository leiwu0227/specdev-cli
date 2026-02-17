import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateSpecdevSystem, isValidSpecdevInstallation, updateSkillFiles, updateHookScript } from '../utils/update.js'
import { SKILL_FILES } from './init.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'

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
    process.exit(1)
  }

  if (dryRun) {
    printSection('🔍 Dry run mode - would update:')
    printBullets([
      '_main.md',
      '_router.md',
      '_guides/ (all task and workflow guides)',
      '_templates/ (scaffolding templates and examples)',
      'skills/core/ (all core workflow skills, fully overwritten)',
      'skills/README.md',
      'project_scaffolding/_README.md',
    ], '   - ')
    blankLine()
    printSection('📌 Preserved (not updated):')
    printBullets([
      'project_notes/ (your project documentation)',
      'assignments/ (your active work)',
      'skills/tools/ (your custom tool skills)',
      'project_scaffolding/ (except _README.md)',
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
    blankLine()
    printSection('📌 Preserved:')
    printBullets([
      'project_notes/ (your project documentation)',
      'assignments/ (your active work)',
      'skills/tools/ (your custom tool skills)',
      'project_scaffolding/ (except _README.md)',
    ], '   • ')
    blankLine()
    console.log('💡 Your project-specific files remain untouched')
    console.log('💡 If this project has legacy assignments, run: specdev migrate')
  } catch (error) {
    console.error('❌ Failed to update SpecDev:', error.message)
    process.exit(1)
  }
}
