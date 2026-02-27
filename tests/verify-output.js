import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const requiredFiles = [
  // System files
  '.specdev/_main.md',
  '.specdev/_index.md',
  '.specdev/_guides/workflow.md',
  '.specdev/_guides/assignment_guide.md',
  '.specdev/_guides/codestyle_guide.md',
  '.specdev/_guides/migration_guide.md',
  // Templates
  '.specdev/_templates/gate_checklist.md',
  '.specdev/_templates/scaffolding_template.md',
  '.specdev/_templates/review_request_schema.json',
  '.specdev/_templates/review_report_template.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/brainstorm/proposal.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/breakdown/plan.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/implementation/implementation.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/review/validation_checklist.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/scaffold/utils_validator.md',
  // Assignment example — context (short-term knowledge)
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/context/decisions.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/context/progress.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/context/messages/.gitkeep',
  // Assignment example — tasks (working knowledge)
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/tasks/_index.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/tasks/01_validator/spec.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/tasks/01_validator/result.md',
  // Project files
  '.specdev/project_notes/big_picture.md',
  '.specdev/project_notes/assignment_progress.md',
  '.specdev/project_notes/feature_descriptions.md',
  '.specdev/project_scaffolding/_README.md',
  '.specdev/assignments/.gitkeep',
  // Skills library
  '.specdev/skills/README.md',
  '.specdev/skills/tools/README.md',
  '.specdev/skills/core/receiving-code-review.md',
  '.specdev/skills/core/verification-before-completion.md',
  // Brainstorming skill (directory-based)
  '.specdev/skills/core/brainstorming/SKILL.md',
  '.specdev/skills/core/brainstorming/scripts/get-project-context.sh',
  // Investigation skill (directory-based)
  '.specdev/skills/core/investigation/SKILL.md',
  // Diagnosis skill (directory-based)
  '.specdev/skills/core/diagnosis/SKILL.md',
  // Breakdown skill (directory-based)
  '.specdev/skills/core/breakdown/SKILL.md',
  // Implementing skill (directory-based)
  '.specdev/skills/core/implementing/SKILL.md',
  '.specdev/skills/core/implementing/scripts/extract-tasks.sh',
  '.specdev/skills/core/implementing/scripts/track-progress.sh',
  '.specdev/skills/core/implementing/prompts/implementer.md',
  '.specdev/skills/core/implementing/prompts/code-reviewer.md',
  // Review-agent skill (directory-based)
  '.specdev/skills/core/review-agent/SKILL.md',
  '.specdev/skills/core/review-agent/scripts/poll-for-feedback.sh',
  '.specdev/skills/core/review-agent/prompts/breakdown-reviewer.md',
  '.specdev/skills/core/review-agent/prompts/implementation-reviewer.md',
  // Knowledge-capture skill (directory-based)
  '.specdev/skills/core/knowledge-capture/SKILL.md',
  // Test-driven-development skill (directory-based)
  '.specdev/skills/core/test-driven-development/SKILL.md',
  '.specdev/skills/core/test-driven-development/scripts/verify-tests.sh',
  // Systematic-debugging skill (directory-based)
  '.specdev/skills/core/systematic-debugging/SKILL.md',
  // Parallel-worktrees skill (directory-based)
  '.specdev/skills/core/parallel-worktrees/SKILL.md',
  '.specdev/skills/core/parallel-worktrees/scripts/setup-worktree.sh',
  // Knowledge vault
  '.specdev/knowledge/_index.md',
  '.specdev/knowledge/_workflow_feedback/.gitkeep',
  '.specdev/knowledge/codestyle/.gitkeep',
  '.specdev/knowledge/architecture/.gitkeep',
  '.specdev/knowledge/domain/.gitkeep',
  '.specdev/knowledge/workflow/.gitkeep',
]

const testDir = './test-output'
const missing = requiredFiles.filter((f) => !existsSync(join(testDir, f)))

if (missing.length > 0) {
  console.error('❌ Verification failed - missing files:')
  missing.forEach((f) => console.error(`   - ${f}`))
  process.exit(1)
}

console.log('✅ All required files present')
console.log(`   Verified ${requiredFiles.length} files`)

// Content checks
const mainMd = readFileSync(join(testDir, '.specdev', '_main.md'), 'utf-8')
if (!mainMd.includes('SpecDev')) {
  console.error('❌ _main.md missing SpecDev reference')
  process.exit(1)
}
if (!mainMd.includes('Specdev:')) {
  console.error('❌ _main.md missing "Specdev:" announcement rule')
  process.exit(1)
}
console.log('✅ _main.md content checks passed')
