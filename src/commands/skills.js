import { join } from 'path'
import fse from 'fs-extra'

export async function skillsCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('❌ No .specdev/skills directory found')
    console.log('   Run "specdev init" first')
    process.exit(1)
  }

  const entries = await fse.readdir(skillsPath)
  const skills = entries
    .filter(
      (f) =>
        f.endsWith('.md') &&
        f !== 'README.md' &&
        f !== 'skills_invoked_template.md' &&
        !f.startsWith('.')
    )
    .sort()

  console.log('🧰 Available SpecDev skills:')
  console.log('')
  for (const skill of skills) {
    console.log(`   - ${skill.replace('.md', '')}`)
  }

  console.log('')
  console.log('ℹ️  See .specdev/skills/README.md for usage and artifact requirements')
}
