import { existsSync } from 'fs'
import { join } from 'path'

const requiredFiles = [
  // System files
  '.specdev/_main.md',
  '.specdev/_router.md',
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
  // Templates
  '.specdev/_templates/gate_checklist.md',
  '.specdev/_templates/scaffolding_template.md',
  '.specdev/_templates/review_request_schema.json',
  '.specdev/_templates/review_report_template.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/proposal.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/plan.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/implementation.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/validation_checklist.md',
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
  '.specdev/skills/scaffolding-lite.md',
  '.specdev/skills/scaffolding-full.md',
  '.specdev/skills/systematic-debugging.md',
  '.specdev/skills/requesting-code-review.md',
  '.specdev/skills/receiving-code-review.md',
  '.specdev/skills/parallel-worktrees.md',
  '.specdev/skills/verification-before-completion.md',
  '.specdev/skills/micro-task-planning.md',
  '.specdev/skills/subagent-driven-development.md',
  '.specdev/skills/review-agent.md',
  '.specdev/skills/skills_invoked_template.md',
  // Brainstorming skill (directory-based)
  '.specdev/skills/brainstorming/SKILL.md',
  '.specdev/skills/brainstorming/scripts/get-project-context.sh',
  // Breakdown skill (directory-based)
  '.specdev/skills/breakdown/SKILL.md',
  // Implementing skill (directory-based)
  '.specdev/skills/implementing/SKILL.md',
  '.specdev/skills/implementing/scripts/extract-tasks.sh',
  '.specdev/skills/implementing/scripts/track-progress.sh',
  '.specdev/skills/implementing/scripts/poll-for-feedback.sh',
  '.specdev/skills/implementing/prompts/implementer.md',
  '.specdev/skills/implementing/prompts/spec-reviewer.md',
  '.specdev/skills/implementing/prompts/code-reviewer.md',
  // Review-agent skill (directory-based)
  '.specdev/skills/review-agent/SKILL.md',
  '.specdev/skills/review-agent/scripts/poll-for-feedback.sh',
  '.specdev/skills/review-agent/prompts/breakdown-reviewer.md',
  '.specdev/skills/review-agent/prompts/implementation-reviewer.md',
  // Knowledge-capture skill (directory-based)
  '.specdev/skills/knowledge-capture/SKILL.md',
  // Test-driven-development skill (directory-based)
  '.specdev/skills/test-driven-development/SKILL.md',
  '.specdev/skills/test-driven-development/scripts/verify-tests.sh',
  // Systematic-debugging skill (directory-based)
  '.specdev/skills/systematic-debugging/SKILL.md',
  // Parallel-worktrees skill (directory-based)
  '.specdev/skills/parallel-worktrees/SKILL.md',
  '.specdev/skills/parallel-worktrees/scripts/setup-worktree.sh',
  // Orientation skill (directory-based)
  '.specdev/skills/orientation/SKILL.md',
  '.specdev/skills/orientation/scripts/list-skills.sh',
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
