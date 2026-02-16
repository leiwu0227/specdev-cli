export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Workflow System Initializer

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
  skills              List available .specdev skills in this project
  main <sub>          Implementer commands (request-review|status|poll-review)
  review <sub>        Reviewer commands (status|start|poll-main|resume|accept|reject)
  ponder workflow     Interactive: review & write workflow feedback
  ponder project      Interactive: review & write local project knowledge
  help                Show this help message
  --version, -v       Show version number

OPTIONS:
  --force, -f       Overwrite existing .specdev folder
  --dry-run         Show what would be copied without copying
  --target=<path>   Specify target directory (default: current directory)

EXAMPLES:
  # Initialize in current directory
  specdev init

  # Request a review (implementer)
  specdev main request-review
  specdev main request-review --mode=manual

  # Check review status (implementer)
  specdev main status

  # Wait for review feedback (implementer)
  specdev main poll-review

  # Scan for pending reviews (reviewer)
  specdev review status

  # Start reviewing (reviewer)
  specdev review start

  # Wait for implementer to signal ready (reviewer)
  specdev review poll-main

  # Resume interrupted review (reviewer)
  specdev review resume

  # Accept or reject (reviewer)
  specdev review accept --notes="looks good"
  specdev review reject --reason="missing tests"

  # Reflect on workflow and capture observations
  specdev ponder workflow

  # Reflect on project and capture knowledge
  specdev ponder project

QUICK START:
  npm install -g github:leiwu0227/specdev-cli
  specdev init

For more information, visit: https://github.com/leiwu0227/specdev-cli
`)
}
