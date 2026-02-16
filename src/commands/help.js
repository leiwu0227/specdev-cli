export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Spec-Driven Workflow for Coding Agents

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
  skills              List available .specdev skills in this project
  start               Check/fill project context (big_picture.md)
  assignment [name]   Create assignment and start brainstorm phase
  breakdown           Validate brainstorm, start breakdown phase
  implement           Validate plan, start implementation phase
  review              Phase-aware manual review (separate session)
  ponder workflow     Interactive: review & write workflow feedback
  ponder project      Interactive: review & write local project knowledge
  help                Show this help message
  --version, -v       Show version number

OPTIONS:
  --force, -f       Overwrite existing .specdev folder
  --dry-run         Show what would be copied without copying
  --target=<path>   Specify target directory (default: current directory)
  --assignment=<id> Specify assignment (default: latest)

WORKFLOW:
  specdev init --platform=claude
  specdev start                     # Fill in project context
  specdev assignment my-feature     # Create assignment, start brainstorm
  specdev breakdown                 # Decompose design into tasks
  specdev implement                 # Execute tasks with TDD

  # Optional: manual review in separate session
  specdev review

  # Knowledge capture
  specdev ponder workflow
  specdev ponder project

For more information, visit: https://github.com/leiwu0227/specdev-cli
`)
}
