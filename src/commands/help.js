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
    '  implement           Set up and kick off implementation phase',
    '  reviewloop <phase>  Automated external review loop (brainstorm | implementation)',
    '  distill              Aggregate knowledge from assignment captures (JSON)',
    '  distill done <name>  Validate and mark assignment as distilled',
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
    '  specdev approve brainstorm        # Hard gate: breakdown begins',
    '  specdev implement                 # Kick off implementation after breakdown',
    '  specdev checkpoint implementation # Validate implementation artifacts',
    '  specdev approve implementation    # Hard gate: proceed to summary',
    '  specdev continue                  # Diagnose state and next action',
    '',
    '  # Optional: review before approving',
    '  specdev review brainstorm         # Manual review (separate session)',
    '  specdev reviewloop brainstorm     # Automated review via external CLI',
    '  specdev review implementation     # Manual review (separate session)',
    '  specdev reviewloop implementation # Automated review via external CLI',
    '  specdev check-review              # Read feedback in main session',
    '',
    '  # Knowledge distillation',
    '  specdev distill --assignment=<name>',
    '  specdev distill done <name>',
  ])
  blankLine()
  printSection('For more information, visit: https://github.com/leiwu0227/specdev-cli')
}
