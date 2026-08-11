import { blankLine, printLines, printSection } from '../utils/output.js'
import { COMMANDS, formatCommandLine } from '../utils/commands.js'

export function helpCommand(flags = {}) {
  if (flags.json) {
    console.log(JSON.stringify({ command: 'help', version: 2, commands: COMMANDS }))
    return
  }
  blankLine()
  printSection('SpecDev — contract-governed orchestration for coding agents')
  blankLine()
  printSection('Usage:')
  printLines(['  specdev <command> [options]'])
  blankLine()
  printSection('Commands:')
  printLines(COMMANDS.map(formatCommandLine))
  blankLine()
  printSection('Normal Assignment:')
  printLines([
    '  specdev assignment "<objective>"',
    '  # collaborate in brainstorm/contract.md',
    '  specdev checkpoint brainstorm',
    '  specdev reviewloop brainstorm       # optional',
    '  specdev approve brainstorm          # only after explicit user agreement',
    '  specdev implement                   # automatic plan + code + evidence + review',
    '  specdev assignment shelf 00001 --reason="pause useful unfinished work"',
    '  specdev assignment close 00001 --outcome=unsupported --reason="verified limit" --evidence=<path>',
    '  specdev assignment --from-assignment=00001  # fresh successor from immutable history',
    '  specdev cancel "work is no longer wanted"   # irreversible abandonment',
  ])
  blankLine()
  printSection('Parallel thought work and larger objectives:')
  printLines([
    '  specdev discussion "<topic>"',
    '  specdev discussion D00001 --complete',
    '  specdev test-audit "<test scope>"',
    '  specdev assignment --from-test-audit=TA00001',
    '  specdev mission create "<objective>"',
    '  specdev reviewloop mission --mission=M00001  # optional',
    '  specdev mission run M00001',
    '  specdev mission status M00001      # includes consolidated execution policy',
    '  specdev mission handoff M00001 --successor-assignment',
    '  specdev mission adopt-successor M00001 --assignment=00042',
    '  specdev mission land M00001',
  ])
}
