#!/usr/bin/env node

import { initCommand } from '../src/commands/init.js'
import { updateCommand } from '../src/commands/update.js'
import { helpCommand } from '../src/commands/help.js'
import { ponderWorkflowCommand } from '../src/commands/ponder-workflow.js'
import { ponderProjectCommand } from '../src/commands/ponder-project.js'
import { skillsCommand } from '../src/commands/skills.js'
import { startCommand } from '../src/commands/start.js'
import { assignmentCommand } from '../src/commands/assignment.js'
import { breakdownCommand } from '../src/commands/breakdown.js'
import { implementCommand } from '../src/commands/implement.js'
import { reviewCommand } from '../src/commands/review.js'
import { migrateCommand } from '../src/commands/migrate.js'
import { continueCommand } from '../src/commands/continue.js'
import { reviseCommand } from '../src/commands/revise.js'
import { checkReviewCommand } from '../src/commands/check-review.js'

const [,, command, ...args] = process.argv

// Parse flags
const flags = {}
const positionalArgs = []

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const equalIndex = arg.indexOf('=')
    if (equalIndex > -1) {
      const key = arg.slice(2, equalIndex)
      const value = arg.slice(equalIndex + 1)
      flags[key] = value
    } else {
      flags[arg.slice(2)] = true
    }
  } else if (arg.startsWith('-')) {
    flags[arg.slice(1)] = true
  } else {
    positionalArgs.push(arg)
  }
})

switch(command) {
  case 'init':
    await initCommand(flags)
    break
  case 'update':
    await updateCommand(flags)
    break
  case 'skills':
    await skillsCommand(flags)
    break
  case 'start':
    await startCommand(flags)
    break
  case 'assignment':
    await assignmentCommand(positionalArgs, flags)
    break
  case 'breakdown':
    await breakdownCommand(flags)
    break
  case 'implement':
    await implementCommand(flags)
    break
  case 'review':
    await reviewCommand(flags)
    break
  case 'migrate':
    await migrateCommand(flags)
    break
  case 'continue':
    await continueCommand(flags)
    break
  case 'revise':
    await reviseCommand(flags)
    break
  case 'check-review':
    await checkReviewCommand(flags)
    break
  case 'ponder': {
    const subcommand = positionalArgs[0]
    if (subcommand === 'workflow') {
      await ponderWorkflowCommand(flags)
    } else if (subcommand === 'project') {
      await ponderProjectCommand(flags)
    } else {
      console.error(`Unknown ponder subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev ponder <workflow|project>')
      process.exit(1)
    }
    break
  }
  case 'help':
  case '--help':
  case '-h':
    helpCommand()
    break
  case '--version':
  case '-v':
    const pkg = await import('../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    break
  default:
    if (!command) {
      helpCommand()
    } else {
      console.error(`Unknown command: ${command}`)
      console.log('Run "specdev help" for usage information')
      process.exit(1)
    }
}
