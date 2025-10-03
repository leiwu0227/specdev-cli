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
    console.log('📖 Next steps:')
    console.log('   1. Ask your coding agent to read .specdev/_main.md to get started')
    console.log('   2. Update .specdev/project_notes/big_picture.md with your project info')
    console.log('   3. Start chatting with the coding agent')
    console.log('')
    console.log('Examples:')
    console.log('   • "I want to develop a new feature called ..."')
    console.log('   • "I want to get familiar with the code base in this folder ..."')
    console.log('   • "I want to refactor this file ..."')
    console.log('   • "I want to fix this bug ..."')
  } catch (error) {
    console.error('❌ Failed to initialize SpecDev:', error.message)
    process.exit(1)
  }
}
