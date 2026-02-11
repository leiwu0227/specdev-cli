export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Workflow System Initializer

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
  skills              List available .specdev skills in this project
  work <sub>          Implementer commands (request|status)
  check <sub>         Reviewer commands (status|run|resume|accept|reject)
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
  specdev work request --gate=gate_3
  specdev work request --gate=gate_3 --mode=manual

  # Check review status (implementer)
  specdev work status

  # Scan for pending reviews (reviewer)
  specdev check status

  # Start reviewing (reviewer)
  specdev check run

  # Resume interrupted review (reviewer)
  specdev check resume

  # Accept or reject (reviewer)
  specdev check accept --notes="looks good"
  specdev check reject --reason="missing tests"

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
