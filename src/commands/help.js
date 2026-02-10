export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Workflow System Initializer

USAGE:
  specdev <command> [options]

COMMANDS:
  init                Initialize .specdev folder in current directory
  update              Update system files while preserving project files
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

  # Initialize with overwrite
  specdev init --force

  # Initialize in specific directory
  specdev init --target=./my-project

  # See what would be copied
  specdev init --dry-run

  # Update system files (preserves project files)
  specdev update

  # Preview what would be updated
  specdev update --dry-run

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
