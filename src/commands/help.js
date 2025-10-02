export function helpCommand() {
  console.log(`
📋 SpecDev CLI - Workflow System Initializer

USAGE:
  specdev <command> [options]

COMMANDS:
  init              Initialize .specdev folder in current directory
  help              Show this help message
  --version, -v     Show version number

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

QUICK START:
  npx @specdev/cli init

For more information, visit: https://github.com/yourname/specdev-cli
`)
}
