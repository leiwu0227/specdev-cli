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
  // Planning skill (directory-based)
  '.specdev/skills/planning/SKILL.md',
  '.specdev/skills/planning/scripts/get-project-context.sh',
  '.specdev/skills/planning/scripts/scaffold-plan.sh',
  '.specdev/skills/planning/scripts/validate-plan.sh',
  '.specdev/skills/planning/scripts/register-assignment.sh',
  // Executing skill (directory-based)
  '.specdev/skills/executing/SKILL.md',
  '.specdev/skills/executing/scripts/extract-tasks.sh',
  '.specdev/skills/executing/scripts/track-progress.sh',
  // Orientation skill (directory-based)
  '.specdev/skills/orientation/SKILL.md',
  '.specdev/skills/orientation/scripts/list-skills.sh',
  // Brainstorming skill (directory-based)
  '.specdev/skills/brainstorming/SKILL.md',
  // Test-driven-development skill (directory-based)
  '.specdev/skills/test-driven-development/SKILL.md',
  '.specdev/skills/test-driven-development/scripts/verify-tests.sh',
  // Systematic-debugging skill (directory-based)
  '.specdev/skills/systematic-debugging/SKILL.md',
  // Verification skill (directory-based)
  '.specdev/skills/verification/SKILL.md',
  '.specdev/skills/verification/scripts/verify-gates.sh',
  // Spec-review skill (directory-based)
  '.specdev/skills/spec-review/SKILL.md',
  '.specdev/skills/spec-review/scripts/get-assignment-context.sh',
  // Code-review skill (directory-based)
  '.specdev/skills/code-review/SKILL.md',
  '.specdev/skills/code-review/prompts/code-reviewer.md',
  '.specdev/skills/code-review/prompts/spec-reviewer.md',
  // Gate-coordination skill (directory-based)
  '.specdev/skills/gate-coordination/SKILL.md',
  '.specdev/skills/gate-coordination/scripts/request-review.sh',
  '.specdev/skills/gate-coordination/scripts/poll-review.sh',
  // Subagent-dispatch skill (directory-based)
  '.specdev/skills/subagent-dispatch/SKILL.md',
  '.specdev/skills/subagent-dispatch/scripts/checkpoint.sh',
  '.specdev/skills/subagent-dispatch/prompts/implementer.md',
  // Parallel-worktrees skill (directory-based)
  '.specdev/skills/parallel-worktrees/SKILL.md',
  '.specdev/skills/parallel-worktrees/scripts/setup-worktree.sh',
  // Knowledge-capture-project skill (directory-based)
  '.specdev/skills/knowledge-capture-project/SKILL.md',
  '.specdev/skills/knowledge-capture-project/scripts/scan-assignment.sh',
  // Knowledge-capture-specdev skill (directory-based)
  '.specdev/skills/knowledge-capture-specdev/SKILL.md',
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
