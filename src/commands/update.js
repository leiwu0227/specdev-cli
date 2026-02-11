import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateSpecdevSystem, isValidSpecdevInstallation } from '../utils/update.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function updateCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
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
    console.log('🔍 Dry run mode - would update:')
    console.log('   - _main.md')
    console.log('   - _router.md')
    console.log('   - _guides/ (all task and workflow guides)')
    console.log('   - _templates/ (scaffolding templates and examples)')
    console.log('   - skills/ (default on-demand skills, missing files only)')
    console.log('   - project_scaffolding/_README.md')
    console.log('')
    console.log('📌 Preserved (not updated):')
    console.log('   - project_notes/ (your project documentation)')
    console.log('   - assignments/ (your active work)')
    console.log('   - skills/ (existing customizations are preserved)')
    console.log('   - project_scaffolding/ (except _README.md)')
    return
  }

  // Update system files
  try {
    console.log('🔄 Updating SpecDev system files...')
    console.log('')

    const updatedPaths = await updateSpecdevSystem(templatePath, specdevPath)

    console.log('✅ SpecDev system files updated successfully!')
    console.log('')
    console.log('📝 Updated:')
    updatedPaths.forEach(path => {
      console.log(`   ✓ ${path}`)
    })
    console.log('')
    console.log('📌 Preserved:')
    console.log('   • project_notes/ (your project documentation)')
    console.log('   • assignments/ (your active work)')
    console.log('   • skills/ (except missing defaults that were created)')
    console.log('   • project_scaffolding/ (except _README.md)')
    console.log('')
    console.log('💡 Your project-specific files remain untouched')
  } catch (error) {
    console.error('❌ Failed to update SpecDev:', error.message)
    process.exit(1)
  }
}
