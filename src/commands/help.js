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
    '  skills              List available skills with activation status',
    '  skills install      Install tool skills with coding agent wrappers',
    '  skills remove <n>   Remove an installed tool skill',
    '  skills sync         Reconcile active tools with available skills',
    '  start               Check/fill project context (big_picture.md)',
    '  migrate             Migrate legacy assignment files to V4 layout',
    '  assignment <desc>   Reserve ID for new assignment, agent names the folder',
    '  checkpoint <phase>  Validate phase artifacts before review',
    '  approve <phase>     Hard gate: approve phase and proceed',
    '  continue            Detect current state and suggest next action',
    '  revise              Record design revision, re-enter brainstorm',
    '  review <phase>      Manual review (brainstorm | implementation)',
    '  check-review        Read and address review feedback',
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
    '  specdev init',
    '  specdev start                     # Fill in project context',
    '  specdev assignment "Add auth"     # Reserve ID, agent names the folder',
    '  specdev checkpoint brainstorm     # Validate brainstorm artifacts',
    '  specdev approve brainstorm        # Hard gate: proceed to breakdown+implementation',
    '  specdev checkpoint implementation # Validate implementation artifacts',
    '  specdev approve implementation    # Hard gate: proceed to summary',
    '  specdev continue                  # Diagnose state and next action',
    '',
    '  # Optional: manual review in separate session',
    '  specdev review brainstorm          # Review design in separate session',
    '  specdev check-review              # Read feedback, address findings',
    '',
    '  # Knowledge capture',
    '  specdev ponder workflow',
    '  specdev ponder project',
  ])
  blankLine()
  printSection('For more information, visit: https://github.com/leiwu0227/specdev-cli')
}
