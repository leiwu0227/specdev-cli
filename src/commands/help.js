import { blankLine, printLines, printSection } from '../utils/output.js'

export function helpCommand() {
  blankLine()
  printSection('📋 SpecDev CLI - Spec-Driven Workflow for Coding Agents')
  blankLine()
  printSection('USAGE:')
  printLines(['  specdev <command> [options]'])
  blankLine()
  printSection('COMMANDS:')
  printLines([
    '  init                Initialize .specdev folder in current directory',
    '  update              Update system files while preserving project files',
    '  skills              List available .specdev skills in this project',
    '  start               Check/fill project context (big_picture.md)',
    '  migrate             Migrate legacy assignment files to V4 layout',
    '  assignment [name]   Create assignment and start brainstorm phase',
    '  continue            Detect current state and suggest next action',
    '  revise              Record design revision, re-enter brainstorm',
    '  breakdown           Validate brainstorm, start breakdown phase',
    '  implement           Validate plan, start implementation phase',
    '  review              Phase-aware manual review (separate session)',
    '  ponder workflow     Interactive: review & write workflow feedback',
    '  ponder project      Interactive: review & write local project knowledge',
    '  help                Show this help message',
    '  --version, -v       Show version number',
  ])
  blankLine()
  printSection('OPTIONS:')
  printLines([
    '  --force, -f       Overwrite existing .specdev folder',
    '  --dry-run         Show what would be copied without copying',
    '  --target=<path>   Specify target directory (default: current directory)',
    '  --assignment=<id> Specify assignment (default: latest)',
  ])
  blankLine()
  printSection('WORKFLOW:')
  printLines([
    '  specdev init --platform=claude',
    '  specdev start                     # Fill in project context',
    '  specdev migrate                   # Convert old assignment artifacts',
    '  specdev continue                  # Diagnose state and next action',
    '  specdev assignment my-feature     # Create assignment, start brainstorm',
    '  specdev breakdown                 # Decompose design into tasks',
    '  specdev implement                 # Execute tasks with TDD',
    '  specdev revise                    # Increment design revision and revise',
    '',
    '  # Optional: manual review in separate session',
    '  specdev review',
    '',
    '  # Knowledge capture',
    '  specdev ponder workflow',
    '  specdev ponder project',
  ])
  blankLine()
  printSection('For more information, visit: https://github.com/leiwu0227/specdev-cli')
}
