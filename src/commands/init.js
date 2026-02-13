import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fse from 'fs-extra'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Platform adapter configurations
function adapterContent(heading) {
  return `# ${heading}\n\nRead \`.specdev/_main.md\` for the full SpecDev workflow and rules.\n`
}

const ADAPTERS = {
  claude:  { path: 'CLAUDE.md',              heading: 'CLAUDE.md' },
  codex:   { path: 'AGENTS.md',              heading: 'AGENTS.md' },
  cursor:  { path: join('.cursor', 'rules'), heading: 'Cursor Rules' },
  generic: { path: 'AGENTS.md',              heading: 'AGENTS.md' },
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
