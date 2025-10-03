import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copySpecdev } from '../utils/copy.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function initCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const force = flags.force || flags.f
  const dryRun = flags['dry-run']

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

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
    await copySpecdev(templatePath, specdevPath, force)

    console.log('✅ SpecDev initialized successfully!')
    console.log('')
    console.log('📁 Created .specdev/ with:')
    console.log('   - _main.md (SpecDev overview)')
    console.log('   - _router.md (routing guide)')
    console.log('   - _guides/ (task & workflow guides)')
    console.log('   - project_notes/ (project documentation)')
    console.log('   - project_scaffolding/ (source code mirror)')
    console.log('   - _templates/ (scaffolding templates & examples)')
    console.log('   - assignments/ (active work folder)')
    console.log('')
    console.log('📖 Next steps:')
    console.log('   1. Read .specdev/_router.md to understand the workflow')
    console.log('   2. Read .specdev/_main.md for SpecDev overview')
    console.log('   3. Update .specdev/project_notes/big_picture.md with your project info')
    console.log('   4. Review .specdev/_templates/assignment_examples/ for worked examples')
    console.log('   5. Start your first assignment in .specdev/assignments/00001_type_name/')
    console.log('')
    console.log('💡 Assignment types: feature, refactor, bugfix, familiarization')
  } catch (error) {
    console.error('❌ Failed to initialize SpecDev:', error.message)
    process.exit(1)
  }
}
