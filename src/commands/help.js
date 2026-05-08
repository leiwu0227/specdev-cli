import { blankLine, printLines, printSection } from '../utils/output.js'
import { COMMANDS, formatCommandLine } from '../utils/commands.js'

export function helpCommand() {
  blankLine()
  printSection('📋 SpecDev CLI - Spec-Driven Workflow for Coding Agents')
  blankLine()
  printSection('USAGE:')
  printLines(['  specdev <command> [options]'])
  blankLine()
  printSection('COMMANDS:')
  printLines(COMMANDS.map(formatCommandLine))
  blankLine()
  printSection('OPTIONS:')
  printLines([
    '  --force, -f       Overwrite existing .specdev folder',
    '  --dry-run         Show what would be copied without copying',
    '  --target=<path>   Specify target directory (default: current directory)',
    '  --assignment=<id> Specify assignment (distill and migrate legacy-assignments only)',
    '  --discussion=<id> Target a discussion instead of an assignment',
    '  --type=<type>     Assignment type for folder creation (assignment command)',
    '  --slug=<slug>     Assignment slug for folder creation (assignment command)',
  ])
  blankLine()
  printSection('WORKFLOW:')
  printLines([
    '  specdev init',
    '  specdev start                     # Fill in project context',
    '  specdev assignment "Add auth"     # Reserve ID, agent names the folder',
    '  specdev focus <id>                # Switch active assignment',
    '  specdev discussion "Explore auth"  # Start a parallel brainstorming discussion',
    '  specdev checkpoint brainstorm     # Validate brainstorm artifacts',
    '  specdev approve brainstorm        # Hard gate: breakdown begins',
    '  specdev implement                 # Kick off implementation after breakdown',
    '  specdev checkpoint implementation # Validate implementation artifacts',
    '  specdev approve implementation    # Hard gate: proceed to summary',
    '  specdev continue                  # Diagnose state and next action',
    '  specdev status --json             # Machine-readable workflow state',
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
