import { existsSync } from 'fs'
import { join } from 'path'

const requiredFiles = [
  '.specdev/main.md',
  '.specdev/router.md',
  '.specdev/_guides/README.md',
  '.specdev/_guides/assignment_guide.md',
  '.specdev/_guides/codestyle_guide.md',
  '.specdev/_guides/task/planning_guide.md',
  '.specdev/_guides/task/scaffolding_guide.md',
  '.specdev/_guides/task/implementing_guide.md',
  '.specdev/_guides/task/validation_guide.md',
  '.specdev/_guides/task/documentation_guide.md',
  '.specdev/_guides/task/research_guide.md',
  '.specdev/_guides/task/presentation_guide.md',
  '.specdev/_guides/workflow/feature_workflow.md',
  '.specdev/_guides/workflow/refactor_workflow.md',
  '.specdev/_guides/workflow/bugfix_workflow.md',
  '.specdev/_guides/workflow/familiarization_workflow.md',
  '.specdev/project_notes/big_picture.md',
  '.specdev/project_notes/assignment_progress.md',
  '.specdev/project_notes/feature_descriptions.md',
  '.specdev/project_scaffolding/README.md',
  '.specdev/_templates/gate_checklist.md',
  '.specdev/_templates/scaffolding_template.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/proposal.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/plan.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/implementation.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/validation_checklist.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/scaffold/utils_validator.md',
  '.specdev/assignments/.gitkeep'
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
