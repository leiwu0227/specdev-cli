import { existsSync } from 'fs'
import { join } from 'path'

const requiredFiles = [
  '.specdev/router.md',
  '.specdev/generic_guides/validation_guide.md',
  '.specdev/generic_guides/scaffolding_guide.md',
  '.specdev/generic_guides/planning_guide.md',
  '.specdev/generic_guides/implementing_guide.md',
  '.specdev/generic_guides/featuring_guide.md',
  '.specdev/generic_guides/codestyle_guide.md',
  '.specdev/project_notes/big_picture.md',
  '.specdev/project_notes/feature_progress.md',
  '.specdev/templates/scaffolding_template.md',
  '.specdev/features/000_example_feature/proposal.md',
  '.specdev/features/000_example_feature/plan.md',
  '.specdev/features/000_example_feature/implementation.md',
  '.specdev/features/000_example_feature/validation_checklist.md',
  '.specdev/features/000_example_feature/scaffold/utils_validator.md'
]

const testDir = './test-output'
const missing = requiredFiles.filter(f => !existsSync(join(testDir, f)))

if (missing.length > 0) {
  console.error('❌ Verification failed - missing files:')
  missing.forEach(f => console.error(`   - ${f}`))
  process.exit(1)
}

console.log('✅ All required files present')
console.log(`   Verified ${requiredFiles.length} files`)
